const Department = require("../models/departmentModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const Material = require("../models/materialModel");
const MaterialRequest = require("../models/materialRequestModel");
const { sanitizePrivilegeMap } = require("../utils/permissionCatalog");
const {
  tenantFilter,
  projectFilter,
  departmentFilter,
  resolveProject,
  isValidId,
  toId,
} = require("../utils/tenantScope");
const { sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

function toPublic(item, projectNames = {}) {
  return {
    id: item._id.toString(),
    name: item.name,
    key: item.key,
    projectId: item.projectId ? item.projectId.toString() : "",
    project: projectNames[String(item.projectId)] || "",
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

async function projectNamesFor(req, departments) {
  const ids = [...new Set(departments.map((item) => String(item.projectId)))];
  const projects = await Project.find(tenantFilter(req, { _id: { $in: ids.map(toId) } })).select("name");
  return Object.fromEntries(projects.map((item) => [String(item._id), item.name]));
}

const listDepartments = async (req, res) => {
  try {
    const extra = { ...projectFilter(req), ...(req.user.role === "super_admin" ? {} : departmentFilter(req, { field: "_id" })) };
    if (req.query.projectId) {
      if (!isValidId(req.query.projectId)) return res.status(200).json({ departments: [] });
      extra.$and = [{ projectId: toId(req.query.projectId) }];
    }
    const departments = await Department.find(tenantFilter(req, extra)).sort({ name: 1 });
    const names = await projectNamesFor(req, departments);
    res.status(200).json({ departments: departments.map((item) => toPublic(item, names)) });
  } catch (error) {
    sendError(res, error);
  }
};

const saveDepartment = async (req, res) => {
  try {
    const { name, privileges } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    const nextKey = slugKey(req.body.key || name);
    if (!nextKey) return res.status(400).json({ message: "A valid department key is required" });

    let department = null;
    if (req.params.id) {
      if (!isValidId(req.params.id)) return res.status(404).json({ message: "Department not found" });
      department = await Department.findOne(tenantFilter(req, { _id: toId(req.params.id) }));
      if (!department) return res.status(404).json({ message: "Department not found" });
    }

    const project = department
      ? await resolveProject(req, { projectId: department.projectId })
      : await resolveProject(req, { projectId: req.body.projectId, project: req.body.project });

    if (!department) {
      const exists = await Department.findOne(tenantFilter(req, { projectId: project._id, key: nextKey }));
      if (exists) return res.status(409).json({ message: "This project already has that department" });
      department = await Department.create({
        companyId: req.tenant.companyId,
        projectId: project._id,
        name,
        key: nextKey,
        privileges: privileges ? sanitizePrivilegeMap(privileges, { strict: true }) : { dashboard: ["view"] },
      });
      await logAudit({
        action: "create",
        module: "departments",
        summary: `Created department ${department.name} on ${project.name}`,
        actor: req.user,
        targetType: "department",
        targetId: department._id.toString(),
      });
      return res.status(201).json({ message: "Department created", department: toPublic(department, { [project._id]: project.name }) });
    }

    const oldKey = department.key;
    if (oldKey !== nextKey) {
      const clash = await Department.exists(tenantFilter(req, { projectId: project._id, key: nextKey, _id: { $ne: department._id } }));
      if (clash) return res.status(409).json({ message: "This project already has that department" });
    }
    department.name = name;
    department.key = nextKey;
    if (privileges) {
      department.privileges = sanitizePrivilegeMap(privileges, { strict: true });
      department.markModified("privileges");
    }
    await department.save();

    if (oldKey !== nextKey) {
      await Material.updateMany(tenantFilter(req, { departmentId: department._id }), { department: nextKey });
      await MaterialRequest.updateMany(tenantFilter(req, { departmentId: department._id }), { department: nextKey });
      // User department keys span projects; only rename them when no other department still uses the old key.
      const stillUsed = await Department.exists(tenantFilter(req, { key: oldKey }));
      if (!stillUsed) await User.updateMany(tenantFilter(req, { department: oldKey }), { department: nextKey });
    }

    await logAudit({
      action: "update",
      module: "departments",
      summary: `Updated department ${department.name}`,
      actor: req.user,
      targetType: "department",
      targetId: department._id.toString(),
    });

    res.status(200).json({ message: "Department updated", department: toPublic(department, { [project._id]: project.name }) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteDepartment = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(404).json({ message: "Department not found" });
    const department = await Department.findOne(tenantFilter(req, { _id: toId(req.params.id) }));
    if (!department) return res.status(404).json({ message: "Department not found" });

    const otherWithKey = await Department.exists(tenantFilter(req, { key: department.key, _id: { $ne: department._id } }));
    const assigned = otherWithKey
      ? await User.countDocuments(tenantFilter(req, { departmentIds: department._id }))
      : await User.countDocuments(tenantFilter(req, { $or: [{ department: department.key }, { departmentIds: department._id }] }));
    if (assigned > 0) {
      return res.status(400).json({ message: "Remove users from this department first" });
    }
    const inUse =
      (await Material.exists(tenantFilter(req, { departmentId: department._id }))) ||
      (await MaterialRequest.exists(tenantFilter(req, { departmentId: department._id })));
    if (inUse) {
      return res.status(400).json({ message: "This department has materials or material requests" });
    }
    await Department.deleteOne(tenantFilter(req, { _id: department._id }));
    await logAudit({
      action: "delete",
      module: "departments",
      summary: `Deleted department ${department.name}`,
      actor: req.user,
      targetType: "department",
      targetId: department._id.toString(),
    });
    res.status(200).json({ message: "Department deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { listDepartments, saveDepartment, deleteDepartment };
