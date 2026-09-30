const mongoose = require("mongoose");
const Migration = require("../models/migrationModel");

const MIGRATIONS = [require("./001_multi_tenant")];

/** Runs migrations that have not been recorded yet. Each one must be idempotent. */
async function runMigrations({ log = console.log } = {}) {
  const db = mongoose.connection.db;
  const applied = new Set((await Migration.find().select("name")).map((item) => item.name));
  const results = [];
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.name)) {
      log(`= ${migration.name} already applied`);
      continue;
    }
    log(`> ${migration.name}`);
    const report = await migration.up({ db, log });
    await Migration.create({ name: migration.name, report });
    results.push({ name: migration.name, report });
    log(`✓ ${migration.name}`);
  }
  return results;
}

async function migrationStatus() {
  const applied = await Migration.find().sort({ appliedAt: 1 });
  const names = new Set(applied.map((item) => item.name));
  return MIGRATIONS.map((item) => ({
    name: item.name,
    applied: names.has(item.name),
    appliedAt: applied.find((row) => row.name === item.name)?.appliedAt || null,
  }));
}

module.exports = { runMigrations, migrationStatus, MIGRATIONS };
