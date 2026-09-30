const MaterialRequest = require("../models/materialRequestModel");
const Material = require("../models/materialModel");
const User = require("../models/userModel");
const ProjectManager = require("../models/projectManagerModel");
const { hasPrivilege, scopedMrFilter, normalizeRole } = require("../utils/privileges");
const { logAudit } = require("../utils/audit");
const { nextDocumentNumber } = require("../utils/documentNumber");
const { featureName } = require("../utils/features");
const { httpError, sendError } = require("../utils/httpError");
const {
  tenantFilter,
  projectFilter,
  resolveHierarchy,
  isValidId,
  toId,
} = require("../utils/tenantScope");
const {
  EDITABLE_STATUSES,
  PROCUREMENT_STATUSES,
  findTransition,
  isEditableStatus,
} = require("../workflow/materialRequestFlow");

function formatDate(value = new Date()) {
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function summarizeProducts(products = []) {
  const list = Array.isArray(products)
    ? products
        .filter((item) => (item?.productId || item?.name) && String(item?.quantity || "").trim())
        .map((item) => ({
          productId: String(item.productId || "").trim().toUpperCase(),
          name: String(item.name || "").trim(),
          description: String(item.description || "").trim(),
          quantity: String(item.quantity || "").trim(),
          unit: String(item.unit || "").trim(),
          amount: Number(item.amount) || 0,
        }))
    : [];
  const quantity = list
    .map((item) => `${item.quantity || 0}${item.unit ? ` ${item.unit}` : ""} ${item.name}`.trim())
    .join(", ");
  const amount = list.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return { quantity, amount, products: list };
}

function requireProcurementFeature(req) {
  if (req.tenant.features.includes("procurement")) return;
  throw httpError(403, `${featureName("procurement")} is not enabled for this company.`, "FEATURE_NOT_ENABLED");
}

/** Requester must be an active company user of this department with access to the project. */
async function resolveCreatedFor(req, createdForId, project, department) {
  if (!isValidId(createdForId)) throw httpError(400, "Select who this request is created for");
  const requester = await User.findOne(
    tenantFilter(req, {
      _id: toId(createdForId),
      department: department.key,
      active: { $ne: false },
      $or: [{ allProjects: true }, { projectIds: project._id }, { departmentIds: department._id }],
    })
  );
  if (!requester || requester.isRequestor === false) {
    throw httpError(400, "Select a requestor from this department");
  }
  return requester;
}

async function resolveProjectManager(req, project, department) {
  if (!project || !department) return null;
  const appointment = await ProjectManager.findOne(
    tenantFilter(req, { projectId: project._id, departmentId: department._id })
  );
  if (!appointment?.managerId) return null;
  return User.findOne(tenantFilter(req, { _id: appointment.managerId, active: { $ne: false } }));
}

async function requireProjectManager(req, project, department) {
  const manager = await resolveProjectManager(req, project, department);
  if (!manager) throw httpError(400, "No manager is appointed for this department on this project");
  return manager;
}

async function resolveCatalogLines(req, products, project, department) {
  const summary = summarizeProducts(products);
  if (!summary.products.length) throw httpError(400, "Add at least one material row");
  if (summary.products.some((item) => !item.productId)) throw httpError(400, "Select a product id for each row");

  const ids = [...new Set(summary.products.map((item) => item.productId))];
  const materials = await Material.find(
    tenantFilter(req, {
      productId: { $in: ids },
      active: { $ne: false },
      $or: [{ departmentId: department._id }, { shared: true }],
    })
  );
  const byId = new Map(materials.map((item) => [item.productId, item]));
  const lines = summary.products.map((item) => {
    const material = byId.get(item.productId);
    if (!material) throw httpError(400, `Product ${item.productId} is not listed for this department`);
    if (!material.shared && String(material.projectId) !== String(project._id)) {
      throw httpError(400, `Product ${item.productId} is not listed for this project`);
    }
    return {
      productId: material.productId,
      name: material.name,
      description: item.description || "",
      quantity: item.quantity,
      unit: material.unit || "",
      amount: item.amount,
    };
  });
  const quantity = lines
    .map((item) => `${item.quantity}${item.unit ? ` ${item.unit}` : ""} ${item.name}`.trim())
    .join(", ");
  const amount = lines.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  return { products: lines, quantity, amount };
}

function toPublic(record) {
  return {
    id: record.mrNo,
    mrNo: record.mrNo,
    project: record.project,
    projectId: record.projectId ? String(record.projectId) : "",
    requestedBy: record.requestedBy,
    requestedById: record.requestedById ? String(record.requestedById) : "",
    createdBy: record.createdBy || "",
    createdById: record.createdById ? String(record.createdById) : "",
    assignedTo: record.assignedTo || "",
    assignedToId: record.assignedToId ? String(record.assignedToId) : "",
    department: record.department || "",
    departmentId: record.departmentId ? String(record.departmentId) : "",
    justification: record.justification || "",
    products: record.products || [],
    quantity: record.quantity || "",
    amount: record.amount || 0,
    supplier: record.supplier || "",
    quotation: record.quotation || "",
    status: record.status,
    paymentStatus: record.paymentStatus,
    date: record.date,
    createdAt: record.createdAt,
  };
}

/** Role rules inside the caller's company and projects (tenant/project are enforced by the query). */
function canAccessRecord(req, record) {
  const actor = req.user;
  const scope = req.scope;
  const role = normalizeRole(actor.role);
  if (actor.role === "super_admin") return true;
  if (["procurement", "finance"].includes(role)) return true;
  if (role === "supplier") {
    return ["RFQ Issued", "Ordered", "In transit", "PO Rejected", "Pending Receipt"].includes(record.status);
  }
  if (role === "requestor") {
    return String(record.requestedById) === actor.id || String(record.createdById) === actor.id;
  }
  const inDepartment = !scope.departmentRestricted || scope.departmentIds.includes(String(record.departmentId));
  if (role === "manager") {
    if (record.assignedToId) return String(record.assignedToId) === actor.id;
    return inDepartment;
  }
  if (["department_head", "in_charge", "admin"].includes(role)) return inDepartment;
  return String(record.requestedById) === actor.id;
}

function hasTransitionPrivilege(actor, transition) {
  if (actor.role === "super_admin") return true;
  if (!transition?.privilege) {
    return (
      hasPrivilege(actor, "material_requests", "edit") ||
      hasPrivilege(actor, "approvals", "approve") ||
      hasPrivilege(actor, "approvals", "reject") ||
      hasPrivilege(actor, "purchase_orders", "edit") ||
      hasPrivilege(actor, "deliveries", "edit") ||
      hasPrivilege(actor, "procurement", "edit")
    );
  }
  const [moduleKey, action] = transition.privilege.split(".");
  return hasPrivilege(actor, moduleKey, action);
}

/** Company + project scoped lookup by MR number. Other companies' numbers resolve to 404. */
async function findRecord(req, mrNo) {
  return MaterialRequest.findOne(
    tenantFilter(req, { $and: [{ mrNo: String(mrNo || "") }, projectFilter(req)] })
  );
}

const listAssignees = async (req, res) => {
  try {
    const canLoad =
      hasPrivilege(req.user, "material_requests", "create") ||
      hasPrivilege(req.user, "material_requests", "edit");
    if (!canLoad) return res.status(403).json({ message: "You cannot load requesters" });

    const { project, department } = await resolveHierarchy(req, {
      projectId: req.query.projectId,
      project: req.query.project,
      departmentId: req.query.departmentId,
      department: req.query.department,
    });
    const requesters = await User.find(
      tenantFilter(req, {
        department: department.key,
        active: { $ne: false },
        isRequestor: { $ne: false },
        $or: [{ allProjects: true }, { projectIds: project._id }, { departmentIds: department._id }],
      })
    )
      .sort({ name: 1 })
      .select("name email");
    const manager = await resolveProjectManager(req, project, department);
    res.status(200).json({
      requesters: requesters.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        email: item.email,
      })),
      manager: manager ? { id: manager._id.toString(), name: manager.name } : null,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listRequests = async (req, res) => {
  try {
    const filter = tenantFilter(req, {
      $and: [projectFilter(req), scopedMrFilter(req.user, req.scope)],
    });
    const rows = await MaterialRequest.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ materialRequests: rows.map(toPublic) });
  } catch (error) {
    sendError(res, error);
  }
};

const getRequest = async (req, res) => {
  try {
    const record = await findRecord(req, req.params.id);
    if (!record) return res.status(404).json({ message: "Material request not found" });
    if (!canAccessRecord(req, record)) {
      return res.status(403).json({ message: "You cannot view this material request" });
    }
    res.status(200).json({ materialRequest: toPublic(record) });
  } catch (error) {
    sendError(res, error);
  }
};

const createRequest = async (req, res) => {
  try {
    if (!hasPrivilege(req.user, "material_requests", "create")) {
      return res.status(403).json({ message: "You cannot create material requests" });
    }
    const { justification, products, status, createdForId } = req.body;
    if (!req.body.project && !req.body.projectId) return res.status(400).json({ message: "Project is required" });

    const nextStatus = status === "Requested" ? "Requested" : "Draft";
    const { project, department } = await resolveHierarchy(req, {
      projectId: req.body.projectId,
      project: req.body.project,
      departmentId: req.body.departmentId,
      department: req.body.department || (req.body.departmentId ? undefined : req.user.department),
    });
    const requester = await resolveCreatedFor(req, createdForId, project, department);
    const manager =
      nextStatus === "Requested"
        ? await requireProjectManager(req, project, department)
        : await resolveProjectManager(req, project, department);
    const summary = await resolveCatalogLines(req, products, project, department);

    const mrNo = await nextDocumentNumber(req.tenant.company, "MR");
    const record = await MaterialRequest.create({
      companyId: req.tenant.companyId,
      projectId: project._id,
      departmentId: department._id,
      mrNo,
      project: project.name,
      justification: justification || "",
      products: summary.products,
      quantity: summary.quantity,
      amount: summary.amount,
      requestedBy: requester.name,
      requestedById: requester._id,
      createdBy: req.user.name,
      createdById: req.user.id,
      assignedTo: manager?.name || "",
      assignedToId: manager?._id,
      department: department.key,
      status: nextStatus,
      paymentStatus: "Not started",
      date: formatDate(),
    });

    res.status(201).json({ message: "Material request created", materialRequest: toPublic(record) });
    await logAudit({
      action: "create",
      module: "material_requests",
      summary: `Created ${record.mrNo} (${record.status})`,
      actor: req.user,
      targetType: "material_request",
      targetId: record.mrNo,
      meta: { project: record.project, status: record.status },
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateRequest = async (req, res) => {
  try {
    const record = await findRecord(req, req.params.id);
    if (!record) return res.status(404).json({ message: "Material request not found" });
    if (!canAccessRecord(req, record)) {
      return res.status(403).json({ message: "You cannot update this material request" });
    }

    const { project, projectId, justification, products, status, supplier, paymentStatus, quotation, department, departmentId, createdForId } =
      req.body;
    const previousStatus = record.status;
    const hierarchyChange = Boolean(project || projectId || department || departmentId);
    const contentChange =
      hierarchyChange ||
      justification !== undefined ||
      createdForId !== undefined ||
      Array.isArray(products);
    const statusChange = Boolean(status) && status !== previousStatus;
    const quotationUpdate = quotation !== undefined;
    const role = normalizeRole(req.user.role);

    if (contentChange) {
      if (!hasPrivilege(req.user, "material_requests", "edit")) {
        return res.status(403).json({ message: "You cannot edit material request content" });
      }
      if (!isEditableStatus(record.status)) {
        return res.status(403).json({
          message: "Sent requests cannot be edited. Only Draft or Returned requests can be changed.",
        });
      }
    }

    if (quotationUpdate || paymentStatus || supplier !== undefined) requireProcurementFeature(req);

    if (quotationUpdate) {
      const canQuote =
        req.user.role === "super_admin" ||
        role === "supplier" ||
        role === "procurement";
      if (!canQuote) {
        return res.status(403).json({ message: "You cannot submit quotations" });
      }
      if (!String(quotation || "").trim()) {
        return res.status(400).json({ message: "Quotation text is required" });
      }
      record.quotation = String(quotation).trim();
      if (supplier !== undefined) record.supplier = String(supplier).trim();
      else if (role === "supplier" && !record.supplier) {
        record.supplier = req.user.name;
      }
    }

    if (statusChange) {
      if (PROCUREMENT_STATUSES.includes(status) || PROCUREMENT_STATUSES.includes(previousStatus)) {
        requireProcurementFeature(req);
      }
      const transition = findTransition(req.user.role, previousStatus, status);
      if (!transition) {
        return res.status(403).json({
          message: `Your role cannot move this request from "${previousStatus}" to "${status}".`,
        });
      }
      if (!hasTransitionPrivilege(req.user, transition)) {
        return res.status(403).json({ message: "Missing privilege for this workflow action" });
      }
      if (transition.requiresQuotation && !String(record.quotation || quotation || "").trim()) {
        return res.status(400).json({ message: "Enter quotation text before continuing" });
      }
    } else if (!contentChange && !paymentStatus && supplier === undefined && !quotationUpdate) {
      if (!hasPrivilege(req.user, "material_requests", "edit")) {
        return res.status(403).json({ message: "You cannot update material requests" });
      }
    }

    let projectRecord = null;
    let departmentRecord = null;
    const ensureHierarchy = async () => {
      if (projectRecord && departmentRecord) return;
      const projectChanged = Boolean(projectId || project);
      const input = projectChanged ? { projectId, project } : { projectId: record.projectId };
      if (departmentId || department) Object.assign(input, { departmentId, department });
      else if (!projectChanged && record.departmentId) input.departmentId = record.departmentId;
      // Same department key on the new project (or a legacy MR without departmentId).
      else input.department = record.department;
      const resolved = await resolveHierarchy(req, input);
      projectRecord = resolved.project;
      departmentRecord = resolved.department;
    };

    if (hierarchyChange) {
      await ensureHierarchy();
      record.projectId = projectRecord._id;
      record.project = projectRecord.name;
      record.departmentId = departmentRecord._id;
      record.department = departmentRecord.key;
    }
    if (justification !== undefined) record.justification = justification;
    if (createdForId) {
      await ensureHierarchy();
      const requester = await resolveCreatedFor(req, createdForId, projectRecord, departmentRecord);
      record.requestedBy = requester.name;
      record.requestedById = requester._id;
    }
    const nextStatus = statusChange ? status : record.status;
    if (hierarchyChange || createdForId || nextStatus === "Requested") {
      await ensureHierarchy();
      const manager =
        nextStatus === "Requested"
          ? await requireProjectManager(req, projectRecord, departmentRecord)
          : await resolveProjectManager(req, projectRecord, departmentRecord);
      if (manager) {
        record.assignedTo = manager.name;
        record.assignedToId = manager._id;
      }
    }
    if (Array.isArray(products)) {
      await ensureHierarchy();
      const summary = await resolveCatalogLines(req, products, projectRecord, departmentRecord);
      record.products = summary.products;
      record.quantity = summary.quantity;
      record.amount = summary.amount;
    }
    if (statusChange) {
      record.status = status;
      if (["Ordered", "PO Issued"].includes(status) && record.paymentStatus === "Not started") {
        record.paymentStatus = "Open";
      }
      if (["Delivered", "Closed"].includes(status)) {
        record.paymentStatus = "Released";
      }
    }
    if (supplier !== undefined && !quotationUpdate) record.supplier = supplier;
    if (paymentStatus) record.paymentStatus = paymentStatus;
    await record.save();

    await logAudit({
      action: statusChange ? "status_change" : quotationUpdate ? "quotation" : "update",
      module: "material_requests",
      summary: statusChange
        ? `${record.mrNo}: ${previousStatus} → ${record.status}`
        : quotationUpdate
          ? `Quotation updated on ${record.mrNo}`
          : `Updated ${record.mrNo}`,
      actor: req.user,
      targetType: "material_request",
      targetId: record.mrNo,
      meta: { status: record.status, previousStatus },
    });
    res.status(200).json({ message: "Material request updated", materialRequest: toPublic(record) });
  } catch (error) {
    sendError(res, error);
  }
};

const deleteRequest = async (req, res) => {
  try {
    const record = await findRecord(req, req.params.id);
    if (!record) return res.status(404).json({ message: "Material request not found" });
    if (!canAccessRecord(req, record)) {
      return res.status(403).json({ message: "You cannot delete this material request" });
    }
    const role = normalizeRole(req.user.role);

    if (role === "requestor") {
      const ownsRecord =
        String(record.requestedById) === req.user.id || String(record.createdById) === req.user.id;
      if (!ownsRecord) {
        return res.status(403).json({ message: "You can only delete your own draft requests" });
      }
      if (!EDITABLE_STATUSES.includes(record.status)) {
        return res.status(403).json({ message: "Only draft or returned requests can be deleted" });
      }
    } else if (!hasPrivilege(req.user, "material_requests", "delete")) {
      return res.status(403).json({ message: "You cannot delete material requests" });
    }

    await MaterialRequest.deleteOne(tenantFilter(req, { _id: record._id }));
    await logAudit({
      action: "delete",
      module: "material_requests",
      summary: `Deleted ${record.mrNo}`,
      actor: req.user,
      targetType: "material_request",
      targetId: record.mrNo,
    });
    res.status(200).json({ message: "Material request deleted" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { listAssignees, listRequests, getRequest, createRequest, updateRequest, deleteRequest };
