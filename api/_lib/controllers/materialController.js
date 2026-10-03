const Material = require("../models/materialModel");
const User = require("../models/userModel");
const ProjectManager = require("../models/projectManagerModel");
const {
  tenantFilter,
  projectFilter,
  departmentFilter,
  resolveHierarchy,
  isValidId,
  toId,
  normalizeKey,
  escapeRegex,
} = require("../utils/tenantScope");
const { sendError } = require("../utils/httpError");
const { hasPrivilege } = require("../utils/privileges");
const { logAudit } = require("../utils/audit");

function toPublic(item) {
  return {
    id: item._id.toString(),
    productId: item.productId,
    name: item.name,
    project: item.project || "",
    projectId: item.projectId ? item.projectId.toString() : "",
    department: item.department,
    departmentId: item.departmentId ? item.departmentId.toString() : "",
    unit: item.unit || "",
    stock: Number(item.stock) || 0,
    shared: item.shared === true,
    active: item.active !== false,
  };
}

function normalizeProductId(value) {
  return String(value || "").trim().toUpperCase();
}

function readStock(value, fallback = 0) {
  if (value === undefined || value === null || value === "") return fallback;
  const stock = Number(value);
  if (!Number.isFinite(stock) || stock < 0) {
    const error = new Error("Stock must be zero or more");
    error.statusCode = 400;
    throw error;
  }
  return Math.round(stock * 1000) / 1000;
}

/** Materials the caller may see: own projects/departments, plus company-wide shared stationery. */
function visibleMaterialsFilter(req, extra = {}) {
  const scope = { ...projectFilter(req), ...departmentFilter(req) };
  const and = [{ active: { $ne: false } }, { $or: [scope, { shared: true }] }];
  if (Object.keys(extra).length) and.push(extra);
  return tenantFilter(req, { $and: and });
}

async function findVisibleMaterial(req, id) {
  if (!isValidId(id)) return null;
  return Material.findOne(
    tenantFilter(req, { $and: [{ _id: toId(id) }, projectFilter(req), departmentFilter(req)] })
  );
}

const listDepartmentManagers = async (req, res) => {
  try {
    const { project, department } = await resolveHierarchy(req, {
      projectId: req.query.projectId,
      project: req.query.project,
      departmentId: req.query.departmentId,
      department: req.query.department,
    });
    const managers = await User.find(
      tenantFilter(req, { department: department.key, role: "manager", active: { $ne: false } })
    )
      .sort({ name: 1 })
      .select("name");
    const appointment = await ProjectManager.findOne(
      tenantFilter(req, { projectId: project._id, departmentId: department._id })
    );
    res.status(200).json({
      managers: managers.map((item) => ({ id: item._id.toString(), name: item.name })),
      appointment: appointment
        ? { managerId: appointment.managerId.toString(), managerName: appointment.managerName }
        : null,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const saveProjectManager = async (req, res) => {
  try {
    const { project, department } = await resolveHierarchy(req, req.body);
    if (!isValidId(req.body.managerId)) {
      return res.status(400).json({ message: "Select the department manager for this project" });
    }
    const manager = await User.findOne(
      tenantFilter(req, {
        _id: toId(req.body.managerId),
        department: department.key,
        role: "manager",
        active: { $ne: false },
      })
    );
    if (!manager) {
      return res.status(400).json({ message: "Select a manager appointed for this department" });
    }

    const appointment = await ProjectManager.findOneAndUpdate(
      tenantFilter(req, { projectId: project._id, departmentId: department._id }),
      {
        companyId: req.tenant.companyId,
        projectId: project._id,
        departmentId: department._id,
        project: project.name,
        projectKey: project.key,
        department: department.key,
        managerId: manager._id,
        managerName: manager.name,
      },
      { upsert: true, returnDocument: "after" }
    );
    await logAudit({
      action: "update",
      module: "materials",
      summary: `Appointed ${manager.name} for ${project.name} / ${department.key}`,
      actor: req.user,
      targetType: "project_manager",
      targetId: appointment._id.toString(),
      meta: { project: project.name, department: department.key },
    });
    res.status(200).json({
      message: "Department manager appointed",
      appointment: {
        managerId: manager._id.toString(),
        managerName: manager.name,
        project: project.name,
        projectId: project._id.toString(),
        department: department.key,
        departmentId: department._id.toString(),
      },
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listMaterials = async (req, res) => {
  try {
    const canList = ["materials", "material_requests"].some((moduleKey) => hasPrivilege(req.user, moduleKey, "view"));
    if (!canList) return res.status(403).json({ message: "Missing privilege materials.view" });
    const extra = {};
    if (isValidId(req.query.projectId)) extra.projectId = toId(req.query.projectId);
    else if (req.query.project) {
      extra.project = new RegExp(`^${escapeRegex(String(req.query.project).trim())}$`, "i");
    }
    if (isValidId(req.query.departmentId)) extra.departmentId = toId(req.query.departmentId);
    else if (req.query.department) extra.department = normalizeKey(req.query.department);
    const rows = await Material.find(visibleMaterialsFilter(req, extra)).sort({ productId: 1 });
    res.status(200).json({ materials: rows.map(toPublic) });
  } catch (error) {
    sendError(res, error);
  }
};

const saveMaterial = async (req, res) => {
  try {
    const { name, unit } = req.body;
    const productId = normalizeProductId(req.body.productId);
    if (!productId) return res.status(400).json({ message: "Product id is required" });
    if (!name || !String(name).trim()) return res.status(400).json({ message: "Name is required" });
    const { project, department } = await resolveHierarchy(req, req.body);

    let material = null;
    if (req.params.id) {
      material = await findVisibleMaterial(req, req.params.id);
      if (!material) return res.status(404).json({ message: "Material not found" });
    }

    const duplicate = await Material.findOne(
      tenantFilter(req, { productId, ...(material ? { _id: { $ne: material._id } } : {}) })
    );
    if (duplicate) return res.status(400).json({ message: "Product id already exists" });

    if (!material) {
      material = await Material.create({
        companyId: req.tenant.companyId,
        projectId: project._id,
        departmentId: department._id,
        productId,
        name: String(name).trim(),
        project: project.name,
        department: department.key,
        unit: String(unit || "").trim(),
        stock: readStock(req.body.stock, 0),
        shared: req.body.shared === true,
        active: true,
      });
      await logAudit({
        action: "create",
        module: "materials",
        summary: `Added material ${material.productId} (${material.name})`,
        actor: req.user,
        targetType: "material",
        targetId: material._id.toString(),
        meta: { department: material.department, project: material.project },
      });
      return res.status(201).json({ message: "Material created", material: toPublic(material) });
    }

    material.productId = productId;
    material.name = String(name).trim();
    material.projectId = project._id;
    material.departmentId = department._id;
    material.project = project.name;
    material.department = department.key;
    material.unit = String(unit || "").trim();
    material.stock = readStock(req.body.stock, Number(material.stock) || 0);
    material.shared = req.body.shared === true;
    material.active = true;
    await material.save();

    await logAudit({
      action: "update",
      module: "materials",
      summary: `Updated material ${material.productId}`,
      actor: req.user,
      targetType: "material",
      targetId: material._id.toString(),
      meta: { department: material.department, project: material.project },
    });
    res.status(200).json({ message: "Material updated", material: toPublic(material) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteMaterial = async (req, res) => {
  try {
    const material = await findVisibleMaterial(req, req.params.id);
    if (!material) return res.status(404).json({ message: "Material not found" });
    await Material.deleteOne(tenantFilter(req, { _id: material._id }));
    await logAudit({
      action: "delete",
      module: "materials",
      summary: `Deleted material ${material.productId}`,
      actor: req.user,
      targetType: "material",
      targetId: material._id.toString(),
    });
    res.status(200).json({ message: "Material deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listMaterials,
  listDepartmentManagers,
  saveProjectManager,
  saveMaterial,
  deleteMaterial,
  normalizeProductId,
};
