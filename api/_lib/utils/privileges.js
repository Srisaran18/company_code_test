const Role = require("../models/roleModel");
const Department = require("../models/departmentModel");
const {
  WORKFLOW_ROLES,
  normalizeRole,
  listFilterForRole,
} = require("../workflow/materialRequestFlow");
const { filterPrivilegesByFeatures } = require("./permissionCatalog");

function mergePrivilegeMaps(...maps) {
  const next = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([moduleKey, actions]) => {
      if (!next[moduleKey]) next[moduleKey] = [];
      (actions || []).forEach((action) => {
        if (action && !next[moduleKey].includes(action)) next[moduleKey].push(action);
      });
    });
  });
  return next;
}

/** Roles and departments of ONE company. Department privileges are merged per department key. */
async function buildCompanyCatalog(companyId) {
  const [roles, departments] = await Promise.all([
    Role.find({ companyId }).sort({ name: 1 }),
    Department.find({ companyId }).sort({ name: 1 }),
  ]);
  const rolePrivileges = Object.fromEntries(roles.map((role) => [role.key, role.privileges || {}]));
  const departmentPrivileges = {};
  departments.forEach((item) => {
    departmentPrivileges[item.key] = mergePrivilegeMaps(departmentPrivileges[item.key], item.privileges);
  });
  return { roles, departments, rolePrivileges, departmentPrivileges };
}

function resolvePrivileges(user, rolePrivileges = {}, departmentPrivileges = {}, enabledFeatures = null) {
  const withFeatures = (map) => (enabledFeatures ? filterPrivilegesByFeatures(map, enabledFeatures) : map);

  if (user.role === "super_admin") {
    return withFeatures(JSON.parse(JSON.stringify(rolePrivileges.super_admin || {})));
  }

  const roleKey = normalizeRole(user.role);
  const privileges = mergePrivilegeMaps(
    rolePrivileges[user.role] || rolePrivileges[roleKey] || {},
    user.role === "admin" ? departmentPrivileges[user.department] || {} : {}
  );

  (user.privileges?.allow || []).forEach((item) => {
    const [moduleKey, action] = String(item).split(".");
    if (!moduleKey || !action) return;
    if (!privileges[moduleKey]) privileges[moduleKey] = [];
    if (!privileges[moduleKey].includes(action)) privileges[moduleKey].push(action);
  });

  (user.privileges?.deny || []).forEach((item) => {
    const [moduleKey, action] = String(item).split(".");
    if (!moduleKey || !action || !privileges[moduleKey]) return;
    privileges[moduleKey] = privileges[moduleKey].filter((value) => value !== action);
  });

  return withFeatures(privileges);
}

function hasPrivilege(user, moduleKey, action = "view") {
  if (user.role === "super_admin") return true;
  return Boolean(user.privileges?.[moduleKey]?.includes(action));
}

const ASSIGNABLE_BY_ADMIN = ["requestor", "user"];
const ASSIGNABLE_BY_SUPER = [
  "admin",
  "requestor",
  "user",
  "back_office",
  ...WORKFLOW_ROLES.filter((r) => r !== "requestor"),
];

/**
 * `companyRoleKeys` are the role keys that exist in the actor's company.
 * The company admin may assign any of them (including custom roles) except super_admin.
 */
function canAssignRole(actor, targetRole, companyRoleKeys = null) {
  if (!targetRole) return false;
  if (targetRole === "super_admin") return false;
  if (companyRoleKeys && !companyRoleKeys.includes(targetRole)) return false;
  if (actor.role === "super_admin") {
    return companyRoleKeys ? true : ASSIGNABLE_BY_SUPER.includes(targetRole);
  }
  if (actor.role === "admin") return ASSIGNABLE_BY_ADMIN.includes(targetRole);
  return false;
}

function scopedUserQuery(actor) {
  const companyId = actor.companyId;
  if (actor.role === "super_admin") return { companyId };
  if (actor.role === "admin") {
    return {
      companyId,
      department: actor.department || "__none__",
      role: { $nin: ["super_admin"] },
    };
  }
  return {
    companyId,
    department: actor.department || "__none__",
    role: { $in: ["requestor", "user", "admin"] },
  };
}

function scopedMrFilter(actor, scope) {
  return listFilterForRole(actor, scope);
}

function toPublicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || "",
    companyId: user.companyId ? user.companyId.toString() : "",
    allProjects: user.allProjects === true,
    projectIds: (user.projectIds || []).map(String),
    departmentIds: (user.departmentIds || []).map(String),
    isRequestor: user.isRequestor !== false,
    privileges: user.privileges || { allow: [], deny: [] },
    userCreateLimit: user.role === "super_admin" ? null : Number(user.userCreateLimit ?? 5),
    createdBy: user.createdBy ? user.createdBy.toString() : "",
    active: user.active !== false,
    createdAt: user.createdAt,
  };
}

function generatePassword(length = 10) {
  const crypto = require("crypto");
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += chars[crypto.randomInt(chars.length)];
  }
  return value;
}

module.exports = {
  mergePrivilegeMaps,
  buildCompanyCatalog,
  resolvePrivileges,
  hasPrivilege,
  canAssignRole,
  scopedUserQuery,
  scopedMrFilter,
  toPublicUser,
  generatePassword,
  normalizeRole,
};
