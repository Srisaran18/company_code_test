// Set before app.js runs dotenv (override: false), so the real .env database is never used.
process.env.CONNECTION_STRING = "mongodb://127.0.0.1:1/never-use-real-db";
process.env.JWT_SECRET = process.env.JWT_SECRET_TEST || "test-secret";
process.env.SERVHUB_NO_LISTEN = "true";
process.env.SEED_DEMO_DATA = "false";
process.env.NODE_ENV = "test";
// Keep the suite off the real mailbox. dotenv will not override these.
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

let replSet = null;

async function startDb() {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.CONNECTION_STRING = replSet.getUri("servhub_test");
  await mongoose.connect(process.env.CONNECTION_STRING);
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function stopDb() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

function loadApp() {
  return require("../_lib/app");
}

function tokenFor(user) {
  return jwt.sign({ userId: user._id.toString(), role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
}

let passwordHash = null;
async function makeUser(company, fields) {
  const User = require("../_lib/models/userModel");
  passwordHash = passwordHash || (await bcrypt.hash("secret123", 4));
  return User.create({
    companyId: company ? company._id : null,
    password: passwordHash,
    active: true,
    ...fields,
  });
}

async function makeProject(company, name) {
  const Project = require("../_lib/models/projectModel");
  return Project.create({ companyId: company._id, name, key: name.toLowerCase() });
}

async function makeDepartment(company, project, key, name = key) {
  const Department = require("../_lib/models/departmentModel");
  return Department.create({ companyId: company._id, projectId: project._id, key, name, privileges: {} });
}

async function makeMaterial(company, project, department, productId, name) {
  const Material = require("../_lib/models/materialModel");
  return Material.create({
    companyId: company._id,
    projectId: project._id,
    departmentId: department._id,
    project: project.name,
    department: department.key,
    productId,
    name,
    unit: "pcs",
  });
}

module.exports = { startDb, stopDb, loadApp, tokenFor, makeUser, makeProject, makeDepartment, makeMaterial };
