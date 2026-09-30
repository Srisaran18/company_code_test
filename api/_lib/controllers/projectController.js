const Project = require("../models/projectModel");
const Department = require("../models/departmentModel");
const Material = require("../models/materialModel");
const MaterialRequest = require("../models/materialRequestModel");
const ProjectManager = require("../models/projectManagerModel");
const User = require("../models/userModel");
const { tenantFilter, projectFilter, isValidId, toId } = require("../utils/tenantScope");
const { sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

function toPublic(item) {
  return {
    id: item._id.toString(),
    name: item.name,
    key: item.key,
    code: item.code || "",
    status: item.status,
    createdAt: item.createdAt,
  };
}

function projectKeyOf(value) {
  return String(value || "").trim().toLowerCase();
}

async function findProject(req, id) {
  if (!isValidId(id)) return null;
  return Project.findOne(tenantFilter(req, { _id: toId(id), ...projectFilter(req, "_id") }));
}

const listProjects = async (req, res) => {
  try {
    const rows = await Project.find(tenantFilter(req, projectFilter(req, "_id"))).sort({ name: 1 });
    res.status(200).json({ projects: rows.map(toPublic) });
  } catch (error) {
    sendError(res, error);
  }
};

const getProject = async (req, res) => {
  try {
    const project = await findProject(req, req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const departments = await Department.find(tenantFilter(req, { projectId: project._id })).sort({ name: 1 });
    res.status(200).json({
      project: toPublic(project),
      departments: departments.map((item) => ({ id: item._id.toString(), name: item.name, key: item.key })),
    });
  } catch (error) {
    sendError(res, error);
  }
};

const saveProject = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Project name is required" });
    const key = projectKeyOf(name);

    if (!req.params.id) {
      const exists = await Project.exists(tenantFilter(req, { key }));
      if (exists) return res.status(409).json({ message: "A project with this name already exists" });
      const project = await Project.create({
        companyId: req.tenant.companyId,
        name,
        key,
        code: String(req.body.code || "").trim(),
        status: req.body.status === "inactive" ? "inactive" : "active",
      });
      if (!req.scope.allProjects) {
        await User.updateOne(tenantFilter(req, { _id: toId(req.user.id) }), { $addToSet: { projectIds: project._id } });
      }
      await logAudit({
        action: "create",
        module: "projects",
        summary: `Created project ${project.name}`,
        actor: req.user,
        targetType: "project",
        targetId: project._id.toString(),
      });
      return res.status(201).json({ message: "Project created", project: toPublic(project) });
    }

    const project = await findProject(req, req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (key !== project.key) {
      const clash = await Project.exists(tenantFilter(req, { key, _id: { $ne: project._id } }));
      if (clash) return res.status(409).json({ message: "A project with this name already exists" });
    }
    const renamed = project.name !== name;
    project.name = name;
    project.key = key;
    if (req.body.code !== undefined) project.code = String(req.body.code || "").trim();
    if (req.body.status) project.status = req.body.status === "inactive" ? "inactive" : "active";
    await project.save();

    if (renamed) {
      const filter = tenantFilter(req, { projectId: project._id });
      await Material.updateMany(filter, { project: name });
      await MaterialRequest.updateMany(filter, { project: name });
      await ProjectManager.updateMany(filter, { project: name, projectKey: key });
    }
    await logAudit({
      action: "update",
      module: "projects",
      summary: `Updated project ${project.name}`,
      actor: req.user,
      targetType: "project",
      targetId: project._id.toString(),
    });
    res.status(200).json({ message: "Project updated", project: toPublic(project) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteProject = async (req, res) => {
  try {
    const project = await findProject(req, req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    const filter = tenantFilter(req, { projectId: project._id });
    const inUse =
      (await Department.exists(filter)) ||
      (await Material.exists(filter)) ||
      (await MaterialRequest.exists(filter));
    if (inUse) {
      return res.status(400).json({ message: "Remove this project's departments, materials and requests first, or set it inactive" });
    }
    await Project.deleteOne(tenantFilter(req, { _id: project._id }));
    await User.updateMany(tenantFilter(req, { projectIds: project._id }), { $pull: { projectIds: project._id } });
    await logAudit({
      action: "delete",
      module: "projects",
      summary: `Deleted project ${project.name}`,
      actor: req.user,
      targetType: "project",
      targetId: project._id.toString(),
    });
    res.status(200).json({ message: "Project deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { listProjects, getProject, saveProject, deleteProject };
