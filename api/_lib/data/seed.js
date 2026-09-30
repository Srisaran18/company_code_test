const bcrypt = require("bcryptjs");
const Company = require("../models/companyModel");
const Feature = require("../models/featureModel");
const CompanyFeature = require("../models/companyFeatureModel");
const Project = require("../models/projectModel");
const Role = require("../models/roleModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const Material = require("../models/materialModel");
const ProjectManager = require("../models/projectManagerModel");
const { roleCatalog, rolePrivileges } = require("../workflow/materialRequestFlow");
const { FEATURES, ALWAYS_ON_FEATURES } = require("../utils/permissionCatalog");

const recordAccess = ["view", "create", "edit"];

const departmentDefaults = {
  dashboard: ["view"],
  users: ["view", "create", "edit"],
  material_requests: recordAccess,
  reports: ["view"],
};

/** Default privileges for well-known department keys (used by demo seed and migration). */
const departmentTemplates = {
  hr: { name: "HR", privileges: { ...departmentDefaults } },
  purchase: {
    name: "Purchase",
    privileges: {
      ...departmentDefaults,
      procurement: recordAccess,
      purchase_orders: recordAccess,
      suppliers: recordAccess,
    },
  },
  development: { name: "Development", privileges: { ...departmentDefaults } },
  finance: { name: "Finance", privileges: { ...departmentDefaults, payments: ["view", "approve"] } },
};

/** System role templates. Each company receives its own copies, which it may then edit. */
function systemRoleTemplates() {
  return [
    ...roleCatalog.map((role) => ({
      key: role.key,
      name: role.name,
      privileges: rolePrivileges[role.key] || { dashboard: ["view"] },
    })),
    { key: "user", name: "Requestor (legacy)", privileges: rolePrivileges.requestor },
  ];
}

async function syncFeatures() {
  for (const item of FEATURES) {
    const result = await Feature.updateOne(
      { key: item.key },
      { $set: { name: item.name, description: item.description }, $setOnInsert: { status: "active" } },
      { upsert: true }
    );
    if (item.splitFromCore && result.upsertedCount) {
      const feature = await Feature.findOne({ key: item.key });
      const companies = await Company.find().select("_id");
      for (const company of companies) {
        await CompanyFeature.updateOne(
          { companyId: company._id, featureId: feature._id },
          { $setOnInsert: { featureKey: item.key, enabled: true, startDate: null, endDate: null } },
          { upsert: true }
        );
      }
    }
  }
}

/** Adds missing system roles. Never overwrites a company's edits. */
async function ensureSystemRoles(companyId) {
  for (const role of systemRoleTemplates()) {
    await Role.updateOne(
      { companyId, key: role.key },
      {
        $setOnInsert: { companyId, key: role.key, name: role.name, privileges: role.privileges },
        $set: { isSystemRole: true },
      },
      { upsert: true }
    );
  }
}

async function setCompanyFeatures(companyId, featureKeys, { startDate = null, endDate = null } = {}) {
  const wanted = new Set([...ALWAYS_ON_FEATURES, ...(featureKeys || [])]);
  const features = await Feature.find();
  for (const feature of features) {
    await CompanyFeature.updateOne(
      { companyId, featureId: feature._id },
      {
        $set: { featureKey: feature.key, enabled: wanted.has(feature.key) },
        $setOnInsert: { startDate, endDate },
      },
      { upsert: true }
    );
  }
}

async function provisionCompany(input, { featureKeys = [] } = {}) {
  await syncFeatures();
  const company = await Company.create({
    code: input.code,
    name: input.name,
    legalName: input.legalName || "",
    email: input.email || "",
    phone: input.phone || "",
    address: input.address || "",
    country: input.country || "",
    state: input.state || "",
    city: input.city || "",
    postalCode: input.postalCode || "",
    taxNumber: input.taxNumber || "",
    timezone: input.timezone || "UTC",
    currency: input.currency || "USD",
    logoUrl: input.logoUrl || "",
    status: input.status || "active",
    settings: input.settings || {},
    plan: input.plan || undefined,
  });
  await ensureSystemRoles(company._id);
  await setCompanyFeatures(company._id, featureKeys);
  return company;
}

/* ----------------------------- demo data ----------------------------- */

const demoUsers = [
  { name: "System Administrator", email: "superadmin@erp.com", role: "super_admin" },
  { name: "ERP Admin", email: "admin@erp.com", role: "admin", department: "hr" },
  { name: "Requestor", email: "requestor@erp.com", role: "requestor", department: "hr" },
  { name: "Department Manager", email: "manager@erp.com", role: "manager", department: "hr" },
  { name: "Procurement Officer", email: "procurement@erp.com", role: "procurement", department: "purchase" },
  { name: "Department Head", email: "head@erp.com", role: "department_head", department: "hr" },
  { name: "Finance Officer", email: "finance@erp.com", role: "finance", department: "finance" },
  { name: "Supplier User", email: "supplier@erp.com", role: "supplier", department: "purchase" },
  { name: "Department Incharge", email: "incharge@erp.com", role: "in_charge", department: "hr" },
  { name: "Workspace User", email: "user@erp.com", role: "requestor", department: "hr" },
  { name: "Purchase Requestor", email: "purchase.requestor@erp.com", role: "requestor", department: "purchase" },
  { name: "Purchase Manager", email: "purchase.manager@erp.com", role: "manager", department: "purchase" },
  { name: "Development Requestor", email: "development.requestor@erp.com", role: "requestor", department: "development" },
  { name: "Development Manager", email: "development.manager@erp.com", role: "manager", department: "development" },
  { name: "Finance Requestor", email: "finance.requestor@erp.com", role: "requestor", department: "finance" },
  { name: "Finance Manager", email: "finance.manager@erp.com", role: "manager", department: "finance" },
  { name: "Back Office", email: "backoffice@erp.com", role: "back_office" },
];

const demoMaterials = [
  { productId: "HR-PEN", name: "Ballpoint pen", project: "Office renovation", department: "hr", unit: "box" },
  { productId: "HR-PAPER", name: "A4 paper", project: "Office renovation", department: "hr", unit: "ream" },
  { productId: "PUR-CABLE", name: "Power cable", project: "Site setup", department: "purchase", unit: "pcs" },
  { productId: "PUR-GLOVES", name: "Safety gloves", project: "Site setup", department: "purchase", unit: "pair" },
  { productId: "DEV-LAPTOP", name: "Laptop", project: "Workstation rollout", department: "development", unit: "pcs" },
  { productId: "FIN-FOLDER", name: "Document folder", project: "Year-end audit", department: "finance", unit: "pcs" },
];

async function ensureProject(companyId, name) {
  const key = String(name).trim().toLowerCase();
  return Project.findOneAndUpdate(
    { companyId, key },
    { $setOnInsert: { companyId, key, name: String(name).trim(), status: "active" } },
    { upsert: true, returnDocument: "after" }
  );
}

async function ensureDepartment(companyId, projectId, key) {
  const template = departmentTemplates[key] || { name: key, privileges: { dashboard: ["view"] } };
  return Department.findOneAndUpdate(
    { companyId, projectId, key },
    { $setOnInsert: { companyId, projectId, key, name: template.name, privileges: template.privileges } },
    { upsert: true, returnDocument: "after" }
  );
}

async function seedDemo() {
  const password = process.env.SEED_DEMO_PASSWORD || "123456";
  let company = await Company.findOne({ code: "DAAM" });
  if (!company) {
    company = await provisionCompany(
      { code: "DAAM", name: "DAAM", timezone: "Asia/Riyadh", currency: "SAR", country: "SA", settings: { numberPadding: 4 } },
      { featureKeys: FEATURES.map((item) => item.key) }
    );
  }
  const companyId = company._id;

  for (const item of demoMaterials) {
    const project = await ensureProject(companyId, item.project);
    const department = await ensureDepartment(companyId, project._id, item.department);
    const exists = await Material.findOne({ companyId, productId: item.productId });
    if (!exists) {
      await Material.create({ ...item, companyId, projectId: project._id, departmentId: department._id, active: true });
    }
  }

  const hashed = await bcrypt.hash(password, 10);
  for (const item of demoUsers) {
    const exists = await User.findOne({ email: item.email }).unscoped();
    if (exists) continue;
    await User.create({
      companyId,
      name: item.name,
      email: item.email,
      password: hashed,
      role: item.role,
      department: item.department || "",
      allProjects: true,
      privileges: { allow: [], deny: [] },
      userCreateLimit: 5,
      active: true,
    });
  }

  const departments = await Department.find({ companyId });
  for (const department of departments) {
    const exists = await ProjectManager.findOne({ companyId, projectId: department.projectId, departmentId: department._id });
    if (exists) continue;
    const manager = await User.findOne({
      companyId,
      department: department.key,
      role: "manager",
      active: { $ne: false },
    }).sort({ name: 1 });
    if (!manager) continue;
    const project = await Project.findOne({ companyId, _id: department.projectId });
    await ProjectManager.create({
      companyId,
      projectId: project._id,
      departmentId: department._id,
      project: project.name,
      projectKey: project.key,
      department: department.key,
      managerId: manager._id,
      managerName: manager.name,
    });
  }
  return company;
}

async function seed() {
  await syncFeatures();
  if (process.env.SEED_DEMO_DATA === "true") await seedDemo();
}

module.exports = {
  seed,
  seedDemo,
  syncFeatures,
  ensureSystemRoles,
  setCompanyFeatures,
  provisionCompany,
  systemRoleTemplates,
  departmentTemplates,
  rolePrivileges,
};
