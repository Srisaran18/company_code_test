const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const helpers = require("./helpers");

let db;
let report;

/** Recreates the pre-tenant schema: global unique keys, free-text projects, no companyId. */
async function insertLegacyData() {
  await db.collection("roles").createIndex({ key: 1 }, { unique: true, name: "key_1" });
  await db.collection("departments").createIndex({ key: 1 }, { unique: true, name: "key_1" });
  await db.collection("materials").createIndex({ productId: 1 }, { unique: true, name: "productId_1" });
  await db.collection("materialrequests").createIndex({ mrNo: 1 }, { unique: true, name: "mrNo_1" });

  await db.collection("roles").insertMany([
    { key: "super_admin", name: "Super Admin", privileges: { users: ["view"] } },
    { key: "manager", name: "Department Manager", privileges: { approvals: ["view", "approve"] } },
    { key: "custom_role", name: "Custom", privileges: { dashboard: ["view"] } },
  ]);
  await db.collection("departments").insertMany([
    { key: "hr", name: "HR", privileges: { users: ["view"] } },
    { key: "purchase", name: "Purchase", privileges: {} },
    { key: "unused", name: "Unused", privileges: {} },
  ]);
  await db.collection("users").insertMany([
    { name: "Super", email: "super@erp.com", password: "x", role: "super_admin", department: "" },
    { name: "HR Manager", email: "m@erp.com", password: "x", role: "manager", department: "hr" },
  ]);
  const manager = await db.collection("users").findOne({ email: "m@erp.com" });
  await db.collection("materials").insertMany([
    { productId: "HR-PEN", name: "Pen", project: "Office renovation", department: "hr" },
    { productId: "HR-PAPER", name: "Paper", project: "office renovation ", department: "hr" },
    { productId: "PUR-CABLE", name: "Cable", project: "Site setup", department: "purchase" },
    { productId: "HR-SITE", name: "Helmet", project: "Site setup", department: "hr" },
  ]);
  await db.collection("materialrequests").insertMany([
    { mrNo: "MR-2026-1004", project: "Office renovation", department: "hr", requestedBy: "x", status: "Draft" },
    { mrNo: "MR-2026-1007", project: "Site setup", department: "", requestedBy: "x", status: "Draft" },
  ]);
  await db.collection("projectmanagers").insertOne({
    project: "Office renovation",
    projectKey: "office renovation",
    department: "hr",
    managerId: manager._id,
    managerName: manager.name,
  });
}

before(async () => {
  // Same as scripts/migrate.js: indexes are managed by the migration, not by model compilation.
  mongoose.set("autoIndex", false);
  await helpers.startDb();
  db = mongoose.connection.db;
  await Promise.all(
    (await db.listCollections().toArray()).map((item) => db.collection(item.name).deleteMany({}))
  );
  for (const name of ["roles", "departments", "materials", "materialrequests"]) {
    await db.collection(name).dropIndexes().catch(() => {});
  }
  await insertLegacyData();
  const { runMigrations } = require("../_lib/migrations");
  const results = await runMigrations({ log: () => {} });
  report = results[0].report;
});

after(async () => {
  await helpers.stopDb();
});

test("creates the default company and backfills every document", async () => {
  const company = await db.collection("companies").findOne({ code: "DAAM" });
  assert.ok(company);
  for (const name of ["users", "roles", "departments", "materials", "materialrequests", "projectmanagers"]) {
    assert.equal(await db.collection(name).countDocuments({ companyId: { $ne: company._id } }), 0, name);
  }
  const users = await db.collection("users").find().toArray();
  assert.ok(users.every((item) => item.allProjects === true));
});

test("builds projects from free-text names, merging case/whitespace variants", async () => {
  const projects = await db.collection("projects").find().toArray();
  const keys = projects.map((item) => item.key).sort();
  assert.deepEqual(keys, ["general", "office renovation", "site setup"]);
  assert.ok(report.projectMerges.some((item) => item.key === "office renovation"));
});

test("departments belong to projects; same key on two projects gives two records", async () => {
  const hr = await db.collection("departments").find({ key: "hr" }).toArray();
  assert.equal(hr.length, 2);
  assert.notEqual(String(hr[0].projectId), String(hr[1].projectId));
  assert.ok(hr.every((item) => item.privileges.users));
  const unused = await db.collection("departments").findOne({ key: "unused" });
  const general = await db.collection("projects").findOne({ key: "general" });
  assert.equal(String(unused.projectId), String(general._id));
});

test("materials, MRs and project managers reference the right project/department", async () => {
  const helmet = await db.collection("materials").findOne({ productId: "HR-SITE" });
  const dept = await db.collection("departments").findOne({ _id: helmet.departmentId });
  const project = await db.collection("projects").findOne({ _id: helmet.projectId });
  assert.equal(dept.key, "hr");
  assert.equal(project.key, "site setup");
  assert.equal(String(dept.projectId), String(project._id));

  const legacyMr = await db.collection("materialrequests").findOne({ mrNo: "MR-2026-1007" });
  assert.ok(legacyMr.projectId);
  assert.equal(legacyMr.departmentId, null);

  const pm = await db.collection("projectmanagers").findOne();
  assert.ok(pm.projectId && pm.departmentId);
});

test("roles become company system roles; custom roles are kept", async () => {
  const roles = await db.collection("roles").find().toArray();
  assert.equal(roles.find((item) => item.key === "manager").isSystemRole, true);
  assert.equal(roles.find((item) => item.key === "custom_role").isSystemRole, false);
  assert.deepEqual(roles.find((item) => item.key === "manager").privileges, { approvals: ["view", "approve"] });
  assert.ok(roles.some((item) => item.key === "procurement"));
});

test("MR counter continues after the highest existing number", async () => {
  const counter = await db.collection("counters").findOne({ key: "MR-2026" });
  assert.equal(counter.seq, 1007);
});

test("old global unique indexes are gone and per-company ones exist", async () => {
  const names = (await db.collection("departments").indexes()).map((item) => item.name);
  assert.ok(!names.includes("key_1"));
  assert.ok(names.includes("companyId_1_projectId_1_key_1"));
  const mrNames = (await db.collection("materialrequests").indexes()).map((item) => item.name);
  assert.ok(!mrNames.includes("mrNo_1"));
  assert.ok(mrNames.includes("companyId_1_mrNo_1"));
});

test("running the migration again is a no-op", async () => {
  const before = await db.collection("departments").countDocuments();
  const { MIGRATIONS } = require("../_lib/migrations");
  await MIGRATIONS[0].up({ db, log: () => {} });
  assert.equal(await db.collection("departments").countDocuments(), before);
});
