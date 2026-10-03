const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const Project = require("../models/projectModel");
const Department = require("../models/departmentModel");
const DeleteRequest = require("../models/deleteRequestModel");
const {
  canAssignRole,
  generatePassword,
  hasPrivilege,
  scopedUserQuery,
  toPublicUser,
} = require("../utils/privileges");
const { sanitizePermissionList } = require("../utils/permissionCatalog");
const { tenantFilter, isValidId, toId, canAccessProject } = require("../utils/tenantScope");
const { httpError, sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

const DEFAULT_USER_CREATE_LIMIT = 5;

function companyRoleKeys(req) {
  return (req.tenant.catalog?.roles || []).map((item) => item.key);
}

async function findCompanyUser(req, id) {
  if (!isValidId(id)) return null;
  return User.findOne(tenantFilter(req, { _id: toId(id) }));
}

async function requireCompanyDepartmentKey(req, key) {
  const departmentKey = String(key || "").toLowerCase().trim();
  if (!departmentKey) throw httpError(400, "Department is required");
  const exists = await Department.exists(tenantFilter(req, { key: departmentKey }));
  if (!exists) throw httpError(400, "Select a valid department");
  return departmentKey;
}

/**
 * Validates project/department grants against the caller's company.
 * Only the company admin may grant all projects or projects outside their own scope.
 */
async function resolveAccessInput(req, body, current = null) {
  const isCompanyAdmin = req.user.role === "super_admin";
  const result = {
    allProjects: current ? current.allProjects === true : false,
    projectIds: current ? (current.projectIds || []).map(String) : [],
    departmentIds: current ? (current.departmentIds || []).map(String) : [],
  };

  if (body.allProjects !== undefined) {
    if (!isCompanyAdmin && body.allProjects === true) throw httpError(403, "Only the company admin can grant all projects");
    result.allProjects = body.allProjects === true;
  }

  if (body.projectIds !== undefined) {
    const ids = [...new Set((Array.isArray(body.projectIds) ? body.projectIds : []).map(String))];
    if (ids.some((id) => !isValidId(id))) throw httpError(400, "Invalid project id");
    const found = await Project.find(tenantFilter(req, { _id: { $in: ids.map(toId) } })).select("_id");
    if (found.length !== ids.length) throw httpError(404, "Project not found", "PROJECT_NOT_FOUND");
    if (!isCompanyAdmin && ids.some((id) => !canAccessProject(req, id))) {
      throw httpError(403, "You can only grant projects you can access", "PROJECT_ACCESS_DENIED");
    }
    result.projectIds = ids;
  } else if (!current && !isCompanyAdmin) {
    // Users created by a department admin inherit that admin's projects.
    result.allProjects = req.scope.allProjects;
    result.projectIds = req.scope.allProjects ? [] : [...req.scope.projectIds];
  }

  if (body.departmentIds !== undefined) {
    const ids = [...new Set((Array.isArray(body.departmentIds) ? body.departmentIds : []).map(String))];
    if (ids.some((id) => !isValidId(id))) throw httpError(400, "Invalid department id");
    const found = await Department.find(tenantFilter(req, { _id: { $in: ids.map(toId) } })).select("_id projectId");
    if (found.length !== ids.length) throw httpError(404, "Department not found", "DEPARTMENT_NOT_FOUND");
    if (!result.allProjects && found.some((item) => !result.projectIds.includes(String(item.projectId)))) {
      throw httpError(400, "Departments must belong to the user's projects", "DEPARTMENT_PROJECT_MISMATCH");
    }
    if (!isCompanyAdmin && req.scope.departmentRestricted && ids.some((id) => !req.scope.departmentIds.includes(id))) {
      throw httpError(403, "You can only grant departments you can access", "DEPARTMENT_ACCESS_DENIED");
    }
    result.departmentIds = ids;
  }
  return result;
}

const listUsers = async (req, res) => {
  try {
    const users = await User.find(scopedUserQuery(req.user)).sort({ name: 1 });
    res.status(200).json({ users: users.map(toPublicUser) });
  } catch (error) {
    sendError(res, error);
  }
};

async function countCreatedBy(req) {
  return User.countDocuments(tenantFilter(req, { createdBy: toId(req.user.id) }));
}

const createUser = async (req, res) => {
  try {
    if (!hasPrivilege(req.user, "users", "create")) {
      return res.status(403).json({ message: "You cannot create users" });
    }

    const { name, email, password, role, department, privileges, userCreateLimit } = req.body;
    const targetRole = role || "user";
    if (!canAssignRole(req.user, targetRole, companyRoleKeys(req))) {
      return res.status(403).json({
        message: "You can only create Admin or User accounts.",
      });
    }

    const assignedDepartment = await requireCompanyDepartmentKey(
      req,
      req.user.role === "super_admin" ? department : req.user.department
    );

    if (req.user.role !== "super_admin") {
      const limit = Number(req.userRecord?.userCreateLimit ?? DEFAULT_USER_CREATE_LIMIT);
      const createdCount = await countCreatedBy(req);
      if (createdCount >= limit) {
        return res.status(403).json({
          message: `User create limit reached (${createdCount}/${limit}). Ask Super Admin to raise your authority.`,
          createdCount,
          userCreateLimit: limit,
        });
      }
    }

    const exists = await User.findOne({ email: String(email || "").toLowerCase().trim() }).unscoped();
    if (exists) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const access = await resolveAccessInput(req, req.body);
    const plainPassword = password && String(password).length >= 6 ? password : generatePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const nextLimit =
      req.user.role === "super_admin" && targetRole === "admin" && userCreateLimit !== undefined
        ? Math.max(0, Number(userCreateLimit) || DEFAULT_USER_CREATE_LIMIT)
        : DEFAULT_USER_CREATE_LIMIT;

    const user = await User.create({
      companyId: req.tenant.companyId,
      name,
      email: String(email).toLowerCase().trim(),
      password: hashedPassword,
      role: targetRole,
      department: assignedDepartment,
      ...access,
      privileges: {
        allow: req.user.role === "super_admin" ? sanitizePermissionList(privileges?.allow, { strict: true }) : [],
        deny: req.user.role === "super_admin" ? sanitizePermissionList(privileges?.deny, { strict: true }) : [],
      },
      userCreateLimit: targetRole === "admin" ? nextLimit : DEFAULT_USER_CREATE_LIMIT,
      isRequestor: req.body.isRequestor !== false,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: "User created",
      user: toPublicUser(user),
      password: plainPassword,
    });
    await logAudit({
      action: "create",
      module: "users",
      summary: `Created user ${user.name} (${user.email})`,
      actor: req.user,
      targetType: "user",
      targetId: user._id.toString(),
      meta: { role: user.role, department: user.department },
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateUser = async (req, res) => {
  try {
    if (!hasPrivilege(req.user, "users", "edit")) {
      return res.status(403).json({ message: "You cannot update users" });
    }

    const user = await findCompanyUser(req, req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot update super admin" });
    }
    if (req.user.role !== "super_admin" && user.department !== req.user.department) {
      return res.status(403).json({ message: "You can only update users in your department" });
    }

    const { name, email, password, role, department, privileges, userCreateLimit, active, isRequestor } = req.body;
    if (role && role !== user.role && !canAssignRole(req.user, role, companyRoleKeys(req))) {
      return res.status(403).json({ message: "You cannot assign this role" });
    }

    if (email) {
      const nextEmail = String(email).toLowerCase().trim();
      const taken = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).unscoped();
      if (taken) return res.status(409).json({ message: "Email already in use" });
      user.email = nextEmail;
    }
    if (name) user.name = name;
    if (role) user.role = role;
    if (isRequestor !== undefined) user.isRequestor = isRequestor !== false;
    if (req.user.role === "super_admin" && department !== undefined) {
      user.department = department ? await requireCompanyDepartmentKey(req, department) : "";
    }
    if (["allProjects", "projectIds", "departmentIds"].some((key) => req.body[key] !== undefined)) {
      Object.assign(user, await resolveAccessInput(req, req.body, user));
    }
    if (req.user.role === "super_admin" && privileges) {
      user.privileges = {
        allow: sanitizePermissionList(privileges.allow, { strict: true }),
        deny: sanitizePermissionList(privileges.deny, { strict: true }),
      };
    }
    if (req.user.role === "super_admin" && userCreateLimit !== undefined) {
      user.userCreateLimit = Math.max(0, Number(userCreateLimit) || DEFAULT_USER_CREATE_LIMIT);
    }
    if (active !== undefined) {
      if (user.role === "super_admin") {
        return res.status(403).json({ message: "Cannot deactivate super admin" });
      }
      if (user._id.toString() === req.user.id) {
        return res.status(400).json({ message: "You cannot deactivate your own account" });
      }
      if (!hasPrivilege(req.user, "users", "edit") && !hasPrivilege(req.user, "users", "delete")) {
        return res.status(403).json({ message: "You cannot change user status" });
      }
      user.active = Boolean(active);
    }
    if (password) user.password = await bcrypt.hash(password, 10);
    await user.save();

    await logAudit({
      action: active === false ? "deactivate" : active === true ? "activate" : "update",
      module: "users",
      summary:
        active === false
          ? `Deactivated user ${user.name} (${user.email})`
          : active === true
            ? `Activated user ${user.name} (${user.email})`
            : `Updated user ${user.name} (${user.email})`,
      actor: req.user,
      targetType: "user",
      targetId: user._id.toString(),
      meta: {
        userCreateLimit: user.userCreateLimit,
        active: user.active !== false,
        privileges: user.privileges,
      },
    });

    res.status(200).json({ message: "User updated", user: toPublicUser(user) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteUser = async (req, res) => {
  try {
    const user = await findCompanyUser(req, req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "Super admin cannot be deleted" });
    }

    if (!hasPrivilege(req.user, "users", "delete")) {
      return res.status(403).json({
        message: "You cannot delete users. Send a delete request to super admin.",
      });
    }

    await DeleteRequest.deleteMany(tenantFilter(req, { targetId: user._id, status: "pending" }));
    const snapshot = { name: user.name, email: user.email, role: user.role };
    await User.deleteOne(tenantFilter(req, { _id: user._id }));
    await logAudit({
      action: "delete",
      module: "users",
      summary: `Deleted user ${snapshot.name} (${snapshot.email})`,
      actor: req.user,
      targetType: "user",
      targetId: req.params.id,
      meta: snapshot,
    });
    res.status(200).json({ message: "User deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

const requestDelete = async (req, res) => {
  try {
    if (!hasPrivilege(req.user, "users", "create") && !hasPrivilege(req.user, "users", "edit")) {
      return res.status(403).json({ message: "You cannot request user deletion" });
    }
    if (hasPrivilege(req.user, "users", "delete")) {
      return res.status(400).json({ message: "You already have delete access. Delete the user directly." });
    }

    const user = await findCompanyUser(req, req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot request deletion of your own account" });
    }
    if (user.role === "super_admin") {
      return res.status(403).json({ message: "Super admin cannot be deleted" });
    }
    if (req.user.role !== "super_admin" && user.department !== req.user.department) {
      return res.status(403).json({ message: "You can only request deletes in your department" });
    }

    const existing = await DeleteRequest.findOne(tenantFilter(req, { targetId: user._id, status: "pending" }));
    if (existing) {
      return res.status(409).json({ message: "A delete request is already pending for this user" });
    }

    const request = await DeleteRequest.create({
      companyId: req.tenant.companyId,
      targetType: "user",
      targetId: user._id,
      targetSnapshot: { name: user.name, email: user.email, role: user.role, department: user.department },
      reason: req.body.reason || "",
      requestedBy: req.user.id,
      status: "pending",
    });

    await logAudit({
      action: "request_delete",
      module: "users",
      summary: `Requested delete for ${user.name} (${user.email})`,
      actor: req.user,
      targetType: "user",
      targetId: user._id.toString(),
      meta: { reason: req.body.reason || "" },
    });

    res.status(201).json({
      message: "Delete request sent to super admin",
      request,
    });
  } catch (error) {
    sendError(res, error);
  }
};

function publicProfile(user) {
  return { ...toPublicUser(user), signatureData: user.signatureData || "" };
}

function readSignature(value) {
  if (value === undefined) return undefined;
  const logo = String(value || "");
  if (logo && !/^data:image\/(png|jpeg);base64,/.test(logo)) {
    throw httpError(400, "Signature must be a PNG or JPEG image");
  }
  if (logo.length > 700000) {
    throw httpError(400, "Signature must be smaller than 500 KB");
  }
  return logo;
}

const getProfile = async (req, res) => {
  try {
    const user = await findCompanyUser(req, req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({ user: publicProfile(user) });
  } catch (error) {
    sendError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await findCompanyUser(req, req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const { name, email } = req.body;
    if (name) user.name = name;
    if (email) {
      const nextEmail = String(email).toLowerCase().trim();
      const exists = await User.findOne({ email: nextEmail, _id: { $ne: user._id } }).unscoped();
      if (exists) return res.status(409).json({ message: "Email already in use" });
      user.email = nextEmail;
    }
    if (req.body.signatureData !== undefined) {
      user.signatureData = readSignature(req.body.signatureData);
    }
    await user.save();
    res.status(200).json({ message: "Profile updated", user: publicProfile(user) });
  } catch (error) {
    sendError(res, error);
  }
};

/** Signatures for the PDF only. Same company, and never included on user lists. */
const listSignatures = async (req, res) => {
  try {
    const ids = String(req.query.ids || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => isValidId(id))
      .slice(0, 20);
    if (!ids.length || !req.tenant?.companyId) {
      return res.status(200).json({ signatures: {} });
    }
    const users = await User.find(tenantFilter(req, { _id: { $in: ids.map((id) => toId(id)) } })).select("signatureData");
    const signatures = {};
    users.forEach((user) => {
      signatures[user._id.toString()] = user.signatureData || "";
    });
    res.status(200).json({ signatures });
  } catch (error) {
    sendError(res, error);
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    const user = await User.findById(req.user.id).unscoped();
    if (!user) return res.status(404).json({ message: "User not found" });
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await logAudit({
      action: "password_change",
      module: "auth",
      summary: `${user.name} changed password`,
      actor: req.user,
      targetType: "user",
      targetId: user._id.toString(),
    });
    res.status(200).json({ message: "Password updated" });
  } catch (error) {
    sendError(res, error);
  }
};

const createQuota = async (req, res) => {
  try {
    if (req.user.role === "super_admin") {
      return res.status(200).json({ unlimited: true, createdCount: 0, userCreateLimit: null });
    }
    if (!hasPrivilege(req.user, "users", "create")) {
      return res.status(403).json({ message: "You cannot create users" });
    }
    const limit = Number(req.userRecord?.userCreateLimit ?? DEFAULT_USER_CREATE_LIMIT);
    const createdCount = await countCreatedBy(req);
    res.status(200).json({
      unlimited: false,
      createdCount,
      userCreateLimit: limit,
      remaining: Math.max(0, limit - createdCount),
    });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  requestDelete,
  getProfile,
  updateProfile,
  listSignatures,
  changePassword,
  createQuota,
};
