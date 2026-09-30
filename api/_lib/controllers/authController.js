const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Company = require("../models/companyModel");
const Project = require("../models/projectModel");
const { loadContext } = require("../middlewares/authMiddleware");
const { toPublicUser, scopedUserQuery } = require("../utils/privileges");
const { MODULES } = require("../utils/permissionCatalog");
const { logAudit } = require("../utils/audit");
const { sendError } = require("../utils/httpError");

function toPublicDepartment(item, projectNames = {}) {
  return {
    id: item._id.toString(),
    name: item.name,
    key: item.key,
    projectId: item.projectId ? item.projectId.toString() : "",
    project: projectNames[String(item.projectId)] || "",
    privileges: item.privileges || {},
  };
}

function toPublicCompany(company) {
  return {
    id: company._id.toString(),
    code: company.code,
    name: company.name,
    legalName: company.legalName || "",
    email: company.email || "",
    phone: company.phone || "",
    address: company.address || "",
    timezone: company.timezone,
    currency: company.currency,
    country: company.country || "",
    logoUrl: company.logoUrl || "",
    status: company.status,
    settings: company.settings || {},
  };
}

/** Directory limited to the caller's company (and project scope for departments/projects). */
async function buildDirectory(context) {
  const { tenant, scope, user } = context;
  const { roles, departments, rolePrivileges, departmentPrivileges } = tenant.catalog;
  const projects = await Project.find({
    companyId: tenant.companyId,
    ...(scope.allProjects ? {} : { _id: { $in: scope.projectIds } }),
  }).sort({ name: 1 });
  const projectNames = Object.fromEntries(projects.map((item) => [String(item._id), item.name]));
  const visibleDepartments = departments.filter(
    (item) =>
      projectNames[String(item.projectId)] &&
      (!scope.departmentRestricted || scope.departmentIds.includes(String(item._id)))
  );
  const users = await User.find(scopedUserQuery(user)).sort({ name: 1 });
  return {
    users: users.map(toPublicUser),
    roles: roles.map((item) => ({
      id: item._id.toString(),
      name: item.name,
      key: item.key,
      isSystemRole: item.isSystemRole === true,
    })),
    departments: visibleDepartments.map((item) => toPublicDepartment(item, projectNames)),
    projects: projects.map((item) => ({ id: item._id.toString(), name: item.name, key: item.key, status: item.status })),
    rolePrivileges,
    departmentPrivileges,
  };
}

async function sessionPayload(userOrId) {
  const context = await loadContext(userOrId._id || userOrId);
  const publicUser = toPublicUser(context.record);

  if (context.user.isPlatformAdmin) {
    return {
      user: { ...publicUser, role: "platform_admin", isPlatformAdmin: true },
      role: { key: "platform_admin", name: "Platform Admin" },
      privileges: {},
      company: null,
      features: [],
      permissionCatalog: MODULES,
      directory: { users: [], roles: [], departments: [], projects: [], rolePrivileges: {}, departmentPrivileges: {} },
    };
  }

  const role = context.tenant.catalog.roles.find((item) => item.key === context.record.role);
  return {
    user: publicUser,
    role: role
      ? { id: role._id.toString(), name: role.name, key: role.key }
      : { key: context.record.role, name: context.record.role },
    privileges: context.user.privileges,
    company: toPublicCompany(context.tenant.company),
    features: context.tenant.features,
    permissionCatalog: MODULES,
    scope: {
      allProjects: context.scope.allProjects,
      projectIds: context.scope.projectIds,
      departmentIds: context.scope.departmentIds,
      departmentRestricted: context.scope.departmentRestricted,
    },
    directory: await buildDirectory(context),
  };
}

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      companyId: user.companyId ? user.companyId.toString() : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).unscoped();
    if (!user) {
      await logAudit({
        action: "login_failed",
        module: "auth",
        summary: `Failed sign-in attempt for ${normalizedEmail || "unknown"}`,
        actor: { name: "Unknown", email: normalizedEmail, role: "" },
        meta: { reason: "user_not_found" },
      });
      return res.status(404).json({ message: "Invalid email or password" });
    }

    const actor = { ...user.toObject(), id: user._id.toString(), companyId: user.companyId };
    const isPasswordCorrect = await bcrypt.compare(password || "", user.password);
    if (!isPasswordCorrect) {
      await logAudit({
        action: "login_failed",
        module: "auth",
        summary: `Failed sign-in for ${user.name} (${user.email})`,
        actor,
        targetType: "user",
        targetId: user._id.toString(),
        meta: { reason: "bad_password" },
      });
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.active === false) {
      await logAudit({
        action: "login_failed",
        module: "auth",
        summary: `Deactivated account sign-in blocked for ${user.name}`,
        actor,
        targetType: "user",
        targetId: user._id.toString(),
        meta: { reason: "inactive" },
      });
      return res.status(403).json({ message: "Account is deactivated. Contact Super Admin." });
    }

    if (!user.isPlatformAdmin) {
      const company = user.companyId ? await Company.findById(user.companyId) : null;
      if (!company || company.status !== "active") {
        return res.status(403).json({
          success: false,
          code: "COMPANY_INACTIVE",
          message: "Your company account is not active. Contact your provider.",
        });
      }
    }

    const session = await sessionPayload(user);
    await logAudit({
      action: "login",
      module: "auth",
      summary: `${user.name} signed in`,
      actor,
      targetType: "user",
      targetId: user._id.toString(),
    });
    res.status(200).json({
      message: "Login successful",
      token: signToken(user),
      ...session,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const logout = async (req, res) => {
  try {
    await logAudit({
      action: "logout",
      module: "auth",
      summary: `${req.user.name} signed out`,
      actor: req.user,
      targetType: "user",
      targetId: req.user.id,
    });
    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    sendError(res, error);
  }
};

const me = async (req, res) => {
  try {
    res.status(200).json(await sessionPayload(req.user.id));
  } catch (error) {
    sendError(res, error);
  }
};

const directory = async (req, res) => {
  try {
    const context = await loadContext(req.user.id);
    res.status(200).json(await buildDirectory(context));
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { login, logout, me, directory, sessionPayload, toPublicCompany, toPublicDepartment };
