const Role = require("../models/roleModel");
const User = require("../models/userModel");
const { hasPrivilege } = require("../utils/privileges");
const { sanitizePrivilegeMap, featureForModule } = require("../utils/permissionCatalog");
const { tenantFilter, isValidId, toId } = require("../utils/tenantScope");
const { sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

function toPublic(item) {
  return {
    id: item._id.toString(),
    name: item.name,
    key: item.key,
    description: item.description || "",
    isSystemRole: item.isSystemRole === true,
    privileges: item.privileges || {},
  };
}

function slugKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Rejects unknown permissions. Modules of features the company has not subscribed to cannot be
 * changed: their stored value is kept as-is so it returns if the feature is enabled later.
 */
function validatePrivileges(req, privileges, stored = {}) {
  const clean = sanitizePrivilegeMap(privileges, { strict: true });
  const enabled = (moduleKey) => req.tenant.features.includes(featureForModule(moduleKey));
  const next = Object.fromEntries(Object.entries(clean).filter(([moduleKey]) => enabled(moduleKey)));
  Object.entries(stored || {}).forEach(([moduleKey, actions]) => {
    if (!enabled(moduleKey)) next[moduleKey] = actions;
  });
  return next;
}

const listRoles = async (req, res) => {
  try {
    const roles = await Role.find(tenantFilter(req)).sort({ name: 1 });
    res.status(200).json({ roles: roles.map(toPublic) });
  } catch (error) {
    sendError(res, error);
  }
};

const saveRole = async (req, res) => {
  try {
    const { name, privileges, description } = req.body;
    const rawKey = String(req.body.key || "").trim();
    let key = slugKey(rawKey);
    if (!name || !key) {
      return res.status(400).json({ message: "Name and key are required" });
    }
    if (key === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot change super admin" });
    }

    let role = null;
    if (req.params.id) {
      if (!isValidId(req.params.id)) return res.status(404).json({ message: "Role not found" });
      role = await Role.findOne(tenantFilter(req, { _id: toId(req.params.id) }));
      if (!role) return res.status(404).json({ message: "Role not found" });
    } else {
      role = await Role.findOne(tenantFilter(req, { key }));
    }

    if (!role) {
      if (!hasPrivilege(req.user, "roles", "create")) {
        return res.status(403).json({ message: "You cannot create roles" });
      }
      role = await Role.create({
        companyId: req.tenant.companyId,
        name,
        key,
        description: description || "",
        isSystemRole: false,
        privileges: privileges ? validatePrivileges(req, privileges) : { dashboard: ["view"] },
      });
      await logAudit({
        action: "create",
        module: "roles",
        summary: `Created role ${role.name}`,
        actor: req.user,
        targetType: "role",
        targetId: role._id.toString(),
      });
      return res.status(201).json({ message: "Role created", role: toPublic(role) });
    }

    if (!hasPrivilege(req.user, "roles", "edit") && !hasPrivilege(req.user, "privileges", "edit")) {
      return res.status(403).json({ message: "You cannot update roles" });
    }
    if (role.key === "super_admin" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Cannot change super admin" });
    }

    const oldKey = role.key;
    if (rawKey === oldKey) key = oldKey;
    if (oldKey !== key) {
      if (role.isSystemRole) {
        return res.status(400).json({ message: "System role keys drive the workflow and cannot be changed" });
      }
      const clash = await Role.exists(tenantFilter(req, { key, _id: { $ne: role._id } }));
      if (clash) return res.status(409).json({ message: "A role with this key already exists" });
    }

    role.name = name;
    role.key = key;
    if (description !== undefined) role.description = description;
    if (privileges) role.privileges = validatePrivileges(req, privileges, role.privileges);
    role.markModified("privileges");
    await role.save();

    if (oldKey !== key) {
      await User.updateMany(tenantFilter(req, { role: oldKey }), { role: key });
    }

    await logAudit({
      action: "update",
      module: "roles",
      summary: `Updated role ${role.name}`,
      actor: req.user,
      targetType: "role",
      targetId: role._id.toString(),
      meta: { privileges: role.privileges },
    });
    res.status(200).json({ message: "Role updated", role: toPublic(role) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteRole = async (req, res) => {
  try {
    if (!hasPrivilege(req.user, "roles", "delete")) {
      return res.status(403).json({ message: "You cannot delete roles" });
    }
    if (!isValidId(req.params.id)) return res.status(404).json({ message: "Role not found" });
    const role = await Role.findOne(tenantFilter(req, { _id: toId(req.params.id) }));
    if (!role) return res.status(404).json({ message: "Role not found" });
    if (role.isSystemRole || ["super_admin", "admin", "user"].includes(role.key)) {
      return res.status(400).json({ message: "This system role cannot be deleted" });
    }
    const assigned = await User.countDocuments(tenantFilter(req, { role: role.key }));
    if (assigned > 0) {
      return res.status(400).json({ message: "Remove users from this role first" });
    }
    await Role.deleteOne(tenantFilter(req, { _id: role._id }));
    await logAudit({
      action: "delete",
      module: "roles",
      summary: `Deleted role ${role.name}`,
      actor: req.user,
      targetType: "role",
      targetId: role._id.toString(),
    });
    res.status(200).json({ message: "Role deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { listRoles, saveRole, deleteRole };
