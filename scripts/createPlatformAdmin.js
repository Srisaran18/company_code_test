/**
 * Creates (or promotes) a platform admin. Platform admins belong to no company and can only
 * use /api/v1/platform/*.
 *
 *   npm run create-platform-admin -- --email ops@servhub.io --name "Platform Admin" [--password ...]
 */
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const dbConnect = require("../api/_lib/config/dbConnect");
const User = require("../api/_lib/models/userModel");
const { generatePassword } = require("../api/_lib/utils/privileges");

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = String(arg("email") || "").toLowerCase().trim();
  const name = arg("name") || "Platform Admin";
  if (!email) throw new Error("--email is required");
  const password = arg("password") || generatePassword(16);

  await dbConnect();
  const existing = await User.findOne({ email }).unscoped();
  if (existing && existing.companyId) {
    throw new Error(`${email} belongs to a company. Use a separate email for the platform admin.`);
  }
  const hashed = await bcrypt.hash(password, 10);
  if (existing) {
    existing.isPlatformAdmin = true;
    existing.password = hashed;
    existing.active = true;
    await existing.save();
  } else {
    await User.create({ email, name, password: hashed, role: "platform_admin", isPlatformAdmin: true, companyId: null });
  }
  console.log(`Platform admin ready: ${email}`);
  if (!arg("password")) console.log(`Generated password (shown once): ${password}`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
