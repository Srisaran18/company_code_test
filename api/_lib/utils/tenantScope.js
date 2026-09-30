const mongoose = require("mongoose");
const Project = require("../models/projectModel");
const Department = require("../models/departmentModel");
const { httpError } = require("./httpError");

/** Roles that work across every department of the projects they can access. */
const COMPANY_WIDE_ROLES = Object.freeze(["super_admin", "procurement", "finance", "supplier", "back_office"]);

function isValidId(value) {
  return Boolean(value) && mongoose.Types.ObjectId.isValid(String(value)) && /^[a-f0-9]{24}$/i.test(String(value));
}

function toId(value) {
  return new mongoose.Types.ObjectId(String(value));
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function companyIdOf(req) {
  const companyId = req.tenant?.companyId;
  if (!companyId) throw httpError(403, "No company context for this request", "TENANT_REQUIRED");
  return companyId;
}

/** `companyId` is applied last so caller-supplied filters can never override it. */
function tenantFilter(req, extra = {}) {
  return { ...extra, companyId: companyIdOf(req) };
}

function projectFilter(req, field = "projectId") {
  if (req.scope?.allProjects) return {};
  return { [field]: { $in: (req.scope?.projectIds || []).map(toId) } };
}

function departmentFilter(req, { field = "departmentId", includeUnassigned = false } = {}) {
  if (!req.scope?.departmentRestricted) return {};
  const ids = (req.scope.departmentIds || []).map(toId);
  if (!includeUnassigned) return { [field]: { $in: ids } };
  return { $or: [{ [field]: { $in: ids } }, { [field]: null }] };
}

/** Tenant + project + department scope in one filter. */
function scopedFilter(req, extra = {}, options = {}) {
  const parts = [projectFilter(req), options.skipDepartment ? {} : departmentFilter(req, options), extra].filter(
    (item) => Object.keys(item).length
  );
  const base = parts.length > 1 ? { $and: parts } : parts[0] || {};
  return tenantFilter(req, base);
}

function canAccessProject(req, projectId) {
  if (!projectId) return false;
  if (req.scope?.allProjects) return true;
  return (req.scope?.projectIds || []).includes(String(projectId));
}

function canAccessDepartment(req, departmentId) {
  if (!req.scope?.departmentRestricted) return true;
  return Boolean(departmentId) && (req.scope.departmentIds || []).includes(String(departmentId));
}

/**
 * Finds a project inside the caller's company by id (preferred) or legacy name.
 * Foreign-company ids resolve to 404 so existence is not disclosed.
 */
async function resolveProject(req, { projectId, project } = {}, { required = true } = {}) {
  let record = null;
  if (projectId) {
    if (!isValidId(projectId)) throw httpError(400, "Select a valid project", "INVALID_PROJECT");
    record = await Project.findOne(tenantFilter(req, { _id: toId(projectId) }));
    if (!record) throw httpError(404, "Project not found", "PROJECT_NOT_FOUND");
  } else if (normalizeKey(project)) {
    record = await Project.findOne(tenantFilter(req, { key: normalizeKey(project) }));
    if (!record) throw httpError(400, "Select a valid project", "INVALID_PROJECT");
  } else if (required) {
    throw httpError(400, "Select a project", "PROJECT_REQUIRED");
  } else {
    return null;
  }
  if (record.status === "inactive") throw httpError(400, "This project is inactive", "PROJECT_INACTIVE");
  if (!canAccessProject(req, record._id)) {
    throw httpError(403, "You do not have access to this project", "PROJECT_ACCESS_DENIED");
  }
  return record;
}

/** Finds a department that belongs to `projectRecord` (by id or legacy key) and checks access. */
async function resolveDepartment(req, projectRecord, { departmentId, department } = {}, { required = true } = {}) {
  let record = null;
  if (departmentId) {
    if (!isValidId(departmentId)) throw httpError(400, "Select a valid department", "INVALID_DEPARTMENT");
    record = await Department.findOne(tenantFilter(req, { _id: toId(departmentId) }));
    if (!record) throw httpError(404, "Department not found", "DEPARTMENT_NOT_FOUND");
    if (String(record.projectId) !== String(projectRecord._id)) {
      throw httpError(400, "Department does not belong to this project", "DEPARTMENT_PROJECT_MISMATCH");
    }
  } else if (normalizeKey(department)) {
    record = await Department.findOne(
      tenantFilter(req, { projectId: projectRecord._id, key: normalizeKey(department) })
    );
    if (!record) throw httpError(400, "Select a valid department for this project", "INVALID_DEPARTMENT");
  } else if (required) {
    throw httpError(400, "Select a department", "DEPARTMENT_REQUIRED");
  } else {
    return null;
  }
  if (!canAccessDepartment(req, record._id)) {
    throw httpError(403, "You do not have access to this department", "DEPARTMENT_ACCESS_DENIED");
  }
  return record;
}

async function resolveHierarchy(req, input = {}, options = {}) {
  const project = await resolveProject(req, input, options);
  const department = project ? await resolveDepartment(req, project, input, options) : null;
  return { project, department };
}

/**
 * Loads the caller's access scope. Existing users were migrated with allProjects=true,
 * and fall back to departments that match their `department` key, which is the pre-tenant behaviour.
 */
async function loadScope(user, companyId) {
  const allProjects = user.allProjects === true || user.role === "super_admin";
  const projects = allProjects
    ? await Project.find({ companyId }).select("_id")
    : await Project.find({ companyId, _id: { $in: user.projectIds || [] } }).select("_id");
  const projectIds = projects.map((item) => String(item._id));

  const departmentKey = normalizeKey(user.department);
  const explicit = (user.departmentIds || []).map(String);
  const departmentRestricted =
    !COMPANY_WIDE_ROLES.includes(user.role) && Boolean(departmentKey || explicit.length);

  const or = [];
  if (explicit.length) or.push({ _id: { $in: explicit.map(toId) } });
  if (departmentKey) or.push({ key: departmentKey });
  const departments = or.length
    ? await Department.find({ companyId, projectId: { $in: projectIds.map(toId) }, $or: or }).select("_id key")
    : [];

  return {
    allProjects,
    projectIds,
    departmentIds: departments.map((item) => String(item._id)),
    departmentKeys: [...new Set(departments.map((item) => item.key))],
    departmentRestricted,
  };
}

module.exports = {
  COMPANY_WIDE_ROLES,
  isValidId,
  toId,
  normalizeKey,
  escapeRegex,
  tenantFilter,
  projectFilter,
  departmentFilter,
  scopedFilter,
  canAccessProject,
  canAccessDepartment,
  resolveProject,
  resolveDepartment,
  resolveHierarchy,
  loadScope,
};
