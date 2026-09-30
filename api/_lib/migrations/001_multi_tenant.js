/**
 * 001 — introduce Company → Project → Department tenancy.
 *
 * Phase A (additive, idempotent): create features + default company, backfill companyId,
 *   build Project records from free-text project names, attach departments to projects,
 *   set projectId/departmentId on materials / MRs / project managers, seed MR counters.
 * Before A, the old globally-unique indexes (key_1, mrNo_1, productId_1, ...) are dropped,
 *   because they would block per-project departments.
 * Phase C (constraints): verify no tenant-owned document lacks companyId/projectId, then
 *   create the compound per-company indexes.
 *
 * Nothing is deleted except the obsolete indexes.
 */
const mongoose = require("mongoose");
const { FEATURES } = require("../utils/permissionCatalog");
const { systemRoleTemplates, departmentTemplates } = require("../data/seed");

const { ObjectId } = mongoose.Types;

const TENANT_COLLECTIONS = [
  "users",
  "roles",
  "departments",
  "materials",
  "materialrequests",
  "projectmanagers",
  "audits",
  "deleterequests",
];

const OBSOLETE_INDEXES = {
  roles: ["key_1"],
  departments: ["key_1"],
  materials: ["productId_1"],
  materialrequests: ["mrNo_1"],
  projectmanagers: ["projectKey_1_department_1"],
  deleterequests: ["targetId_1_status_1"],
};

function projectKeyOf(value) {
  return String(value || "").trim().toLowerCase();
}

function titleCase(key) {
  return String(key || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function defaultCompanyInput() {
  return {
    code: (process.env.MIGRATION_COMPANY_CODE || "DAAM").trim().toUpperCase(),
    name: (process.env.MIGRATION_COMPANY_NAME || "DAAM").trim(),
    timezone: process.env.MIGRATION_COMPANY_TIMEZONE || "Asia/Riyadh",
    currency: (process.env.MIGRATION_COMPANY_CURRENCY || "SAR").toUpperCase(),
    country: process.env.MIGRATION_COMPANY_COUNTRY || "SA",
  };
}

async function collectionExists(db, name) {
  return (await db.listCollections({ name }).toArray()).length > 0;
}

async function phaseA(db, log) {
  const report = { company: null, projects: [], projectMerges: [], departmentsCreated: [], counters: [] };
  const now = new Date();

  // 1. Global features
  for (const item of FEATURES) {
    await db.collection("features").updateOne(
      { key: item.key },
      {
        $set: { name: item.name, description: item.description, updatedAt: now },
        $setOnInsert: { key: item.key, status: "active", createdAt: now },
      },
      { upsert: true }
    );
  }
  const features = await db.collection("features").find().toArray();

  // 2. Default company for all existing data
  const input = defaultCompanyInput();
  let company = await db.collection("companies").findOne({ code: input.code });
  if (!company) {
    const doc = {
      ...input,
      legalName: "",
      email: "",
      phone: "",
      address: "",
      logoUrl: "",
      status: "active",
      // Existing MR numbers are MR-YYYY-NNNN; keep 4 digits for this tenant.
      settings: { dateFormat: "DD-MM-YYYY", mrPrefix: "MR", woPrefix: "WO", poPrefix: "PO", numberPadding: 4 },
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("companies").insertOne(doc);
    company = { ...doc, _id: result.insertedId };
    log(`Created default company ${input.code}`);
  }
  const companyId = company._id;
  report.company = { id: String(companyId), code: company.code };

  for (const feature of features) {
    await db.collection("companyfeatures").updateOne(
      { companyId, featureId: feature._id },
      {
        $setOnInsert: {
          companyId,
          featureId: feature._id,
          featureKey: feature.key,
          enabled: true,
          startDate: null,
          endDate: null,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // 3. Backfill companyId on every tenant-owned collection
  for (const name of TENANT_COLLECTIONS) {
    if (!(await collectionExists(db, name))) continue;
    const filter = { $or: [{ companyId: { $exists: false } }, { companyId: null }] };
    if (name === "users") filter.isPlatformAdmin = { $ne: true };
    if (name === "audits") filter.$or = [{ companyId: { $exists: false } }];
    const result = await db.collection(name).updateMany(filter, { $set: { companyId } });
    if (result.modifiedCount) log(`${name}: companyId set on ${result.modifiedCount} documents`);
  }

  // Users keep their current visibility: every project, department from their existing key.
  await db.collection("users").updateMany(
    { companyId, allProjects: { $exists: false } },
    { $set: { allProjects: true, projectIds: [], departmentIds: [], isPlatformAdmin: false } }
  );

  // Roles become this company's own system roles.
  const systemKeys = systemRoleTemplates().map((item) => item.key);
  await db.collection("roles").updateMany(
    { companyId, isSystemRole: { $exists: false } },
    [{ $set: { isSystemRole: { $in: ["$key", systemKeys] }, description: { $ifNull: ["$description", ""] } } }]
  );
  for (const role of systemRoleTemplates()) {
    await db.collection("roles").updateOne(
      { companyId, key: role.key },
      {
        $setOnInsert: {
          companyId,
          key: role.key,
          name: role.name,
          description: "",
          privileges: role.privileges,
          isSystemRole: true,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true }
    );
  }

  // The company admin role gains the two new modules introduced with tenancy.
  await db.collection("roles").updateOne(
    { companyId, key: "super_admin", "privileges.projects": { $exists: false } },
    {
      $set: {
        "privileges.projects": ["view", "create", "edit", "delete"],
        "privileges.company_settings": ["view", "edit"],
      },
    }
  );

  // 4. Projects from the distinct free-text names in use
  const variants = new Map();
  const addName = (value) => {
    const key = projectKeyOf(value);
    if (!key) return;
    if (!variants.has(key)) variants.set(key, new Set());
    variants.get(key).add(String(value).trim());
  };
  for (const name of ["materials", "materialrequests", "projectmanagers"]) {
    if (!(await collectionExists(db, name))) continue;
    const values = await db.collection(name).distinct("project", { companyId });
    values.forEach(addName);
  }

  const projectByKey = new Map();
  const existingProjects = await db.collection("projects").find({ companyId }).toArray();
  existingProjects.forEach((item) => projectByKey.set(item.key, item));
  for (const [key, names] of variants) {
    if (names.size > 1) report.projectMerges.push({ key, names: [...names] });
    if (projectByKey.has(key)) continue;
    const doc = { companyId, key, name: [...names][0], code: "", status: "active", createdAt: now, updatedAt: now };
    const result = await db.collection("projects").insertOne(doc);
    projectByKey.set(key, { ...doc, _id: result.insertedId });
    report.projects.push(doc.name);
  }

  for (const name of ["materials", "materialrequests", "projectmanagers"]) {
    if (!(await collectionExists(db, name))) continue;
    const rows = await db.collection(name).find({ companyId, projectId: { $exists: false } }).project({ project: 1 }).toArray();
    const ops = rows
      .map((row) => {
        const project = projectByKey.get(projectKeyOf(row.project));
        return project ? { updateOne: { filter: { _id: row._id }, update: { $set: { projectId: project._id } } } } : null;
      })
      .filter(Boolean);
    if (ops.length) await db.collection(name).bulkWrite(ops);
  }

  // 5. Departments belong to a project. One record per (project, department key) in use.
  const pairs = new Map();
  const addPair = (projectId, departmentKey) => {
    const key = String(departmentKey || "").trim().toLowerCase();
    if (!projectId || !key) return;
    pairs.set(`${projectId}|${key}`, { projectId, key });
  };
  for (const name of ["materials", "materialrequests", "projectmanagers"]) {
    if (!(await collectionExists(db, name))) continue;
    const rows = await db.collection(name).find({ companyId, projectId: { $exists: true } }).project({ projectId: 1, department: 1 }).toArray();
    rows.forEach((row) => addPair(row.projectId, row.department));
  }

  const legacyByKey = new Map();
  const legacy = await db.collection("departments").find({ companyId, projectId: { $exists: false } }).toArray();
  legacy.forEach((item) => legacyByKey.set(item.key, item));
  const reused = new Set();

  const ensureDepartment = async (projectId, key) => {
    const existing = await db.collection("departments").findOne({ companyId, projectId, key });
    if (existing) return existing;
    const source = legacyByKey.get(key);
    if (source && !reused.has(key)) {
      // First project using this key keeps the original document (and its _id).
      reused.add(key);
      await db.collection("departments").updateOne({ _id: source._id }, { $set: { projectId } });
      return { ...source, projectId };
    }
    const template = departmentTemplates[key];
    const doc = {
      companyId,
      projectId,
      key,
      name: source?.name || template?.name || titleCase(key),
      privileges: source?.privileges || template?.privileges || { dashboard: ["view"] },
      createdAt: now,
      updatedAt: now,
    };
    const result = await db.collection("departments").insertOne(doc);
    report.departmentsCreated.push(`${key} @ ${projectId}`);
    return { ...doc, _id: result.insertedId };
  };

  const departmentId = new Map();
  for (const { projectId, key } of pairs.values()) {
    const dept = await ensureDepartment(projectId, key);
    departmentId.set(`${projectId}|${key}`, dept._id);
  }

  // Departments not used on any project (and user departments without a record) go to "General".
  const userKeys = (await db.collection("users").distinct("department", { companyId })).filter(Boolean);
  const orphanKeys = [...new Set([...legacyByKey.keys(), ...userKeys])].filter(
    (key) => !reused.has(key) && ![...pairs.values()].some((pair) => pair.key === key)
  );
  if (orphanKeys.length) {
    let general = projectByKey.get("general");
    if (!general) {
      const doc = { companyId, key: "general", name: "General", code: "", status: "active", createdAt: now, updatedAt: now };
      const result = await db.collection("projects").insertOne(doc);
      general = { ...doc, _id: result.insertedId };
      projectByKey.set("general", general);
      report.projects.push("General");
    }
    for (const key of orphanKeys) await ensureDepartment(general._id, key);
  }

  for (const name of ["materials", "materialrequests", "projectmanagers"]) {
    if (!(await collectionExists(db, name))) continue;
    const rows = await db.collection(name)
      .find({ companyId, projectId: { $exists: true }, departmentId: { $exists: false } })
      .project({ projectId: 1, department: 1 })
      .toArray();
    const ops = rows.map((row) => {
      const id = departmentId.get(`${row.projectId}|${String(row.department || "").trim().toLowerCase()}`) || null;
      return { updateOne: { filter: { _id: row._id }, update: { $set: { departmentId: id } } } };
    });
    if (ops.length) await db.collection(name).bulkWrite(ops);
  }

  // 6. MR counters continue from the highest existing number per year
  if (await collectionExists(db, "materialrequests")) {
    const numbers = await db.collection("materialrequests").distinct("mrNo", { companyId });
    const maxByYear = {};
    numbers.forEach((value) => {
      const match = /^([A-Z]+)-(\d{4})-(\d+)$/.exec(String(value));
      if (!match) return;
      const key = `${match[1]}-${match[2]}`;
      maxByYear[key] = Math.max(maxByYear[key] || 0, Number(match[3]));
    });
    for (const [key, seq] of Object.entries(maxByYear)) {
      await db.collection("counters").updateOne(
        { companyId, key },
        { $max: { seq }, $setOnInsert: { createdAt: now }, $set: { updatedAt: now } },
        { upsert: true }
      );
      report.counters.push({ key, seq });
    }
  }

  return report;
}

async function verify(db) {
  const problems = [];
  for (const name of TENANT_COLLECTIONS) {
    if (!(await collectionExists(db, name))) continue;
    const filter = { $or: [{ companyId: { $exists: false } }, { companyId: null }] };
    if (name === "users") filter.isPlatformAdmin = { $ne: true };
    if (name === "audits") filter.$or = [{ companyId: { $exists: false } }];
    const count = await db.collection(name).countDocuments(filter);
    if (count) problems.push(`${name}: ${count} documents without companyId`);
  }
  for (const name of ["materials", "materialrequests", "projectmanagers", "departments"]) {
    if (!(await collectionExists(db, name))) continue;
    const count = await db.collection(name).countDocuments({ $or: [{ projectId: { $exists: false } }, { projectId: null }] });
    if (count) problems.push(`${name}: ${count} documents without projectId`);
  }
  for (const name of ["materials", "projectmanagers"]) {
    if (!(await collectionExists(db, name))) continue;
    const count = await db.collection(name).countDocuments({ $or: [{ departmentId: { $exists: false } }, { departmentId: null }] });
    if (count) problems.push(`${name}: ${count} documents without departmentId`);
  }
  return problems;
}

/**
 * Globally-unique legacy indexes block per-company duplicates (e.g. "hr" under two projects),
 * so they are dropped before the backfill. Uniqueness is restored per company in phase C.
 */
async function dropObsoleteIndexes(db, log) {
  for (const [name, indexes] of Object.entries(OBSOLETE_INDEXES)) {
    if (!(await collectionExists(db, name))) continue;
    const present = (await db.collection(name).indexes()).map((item) => item.name);
    for (const index of indexes) {
      if (!present.includes(index)) continue;
      await db.collection(name).dropIndex(index);
      log(`Dropped obsolete index ${name}.${index}`);
    }
  }
}

async function phaseC(db, log, models) {
  const problems = await verify(db);
  if (problems.length) {
    throw new Error(`Refusing to add constraints; data is not valid yet:\n - ${problems.join("\n - ")}`);
  }
  for (const model of models) {
    await model.createIndexes();
  }
  log("Compound tenant indexes ensured");
}

async function up({ db, log = console.log }) {
  const models = [
    require("../models/companyModel"),
    require("../models/projectModel"),
    require("../models/featureModel"),
    require("../models/companyFeatureModel"),
    require("../models/counterModel"),
    require("../models/userModel"),
    require("../models/roleModel"),
    require("../models/departmentModel"),
    require("../models/materialModel"),
    require("../models/materialRequestModel"),
    require("../models/projectManagerModel"),
    require("../models/auditModel"),
    require("../models/deleteRequestModel"),
  ];
  await dropObsoleteIndexes(db, log);
  const report = await phaseA(db, log);
  if (report.projectMerges.length) {
    log("Project name variants merged (same name ignoring case/whitespace):");
    report.projectMerges.forEach((item) => log(`  ${item.key}: ${item.names.join(" | ")}`));
  }
  await phaseC(db, log, models);
  return report;
}

module.exports = { name: "001_multi_tenant", up, phaseA, phaseC, verify, dropObsoleteIndexes, OBSOLETE_INDEXES };
