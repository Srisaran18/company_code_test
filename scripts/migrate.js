/**
 * Usage:
 *   npm run migrate            apply pending migrations
 *   npm run migrate -- --status
 *
 * Take a database backup (Atlas snapshot or mongodump) before running against production.
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const mongoose = require("mongoose");

mongoose.set("autoIndex", false);

const dbConnect = require("../api/_lib/config/dbConnect");
const { runMigrations, migrationStatus } = require("../api/_lib/migrations");

async function main() {
  await dbConnect();
  if (process.argv.includes("--status")) {
    console.table(await migrationStatus());
    return;
  }
  const results = await runMigrations();
  for (const { name, report } of results) {
    console.log(`\n${name} report:`);
    console.log(JSON.stringify(report, null, 2));
  }
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error("Migration failed:", error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
