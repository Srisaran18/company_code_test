const Company = require("../models/companyModel");
const Project = require("../models/projectModel");
const { httpError } = require("./httpError");

function slugCode(value, { min = 2, max = 12, fallback = "CO" } = {}) {
  const cleaned = String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, max);
  if (cleaned.length >= min) return cleaned;
  return `${cleaned}${fallback}`.replace(/[^A-Z0-9]/g, "").slice(0, Math.max(min, fallback.length));
}

async function nextUniqueCode({ exists, seed, max = 20, fallback = "CO" }) {
  const base = slugCode(seed, { max: Math.min(12, max), fallback }) || fallback;
  if (!(await exists(base))) return base;
  for (let n = 2; n < 10000; n += 1) {
    const suffix = String(n);
    const candidate = `${base.slice(0, Math.max(1, max - suffix.length))}${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  throw httpError(409, "Could not allocate a unique code");
}

async function uniqueCompanyCode() {
  const rows = await Company.find({ code: { $regex: /^\d+$/ } }).select("code").lean();
  let next = rows.reduce((max, item) => Math.max(max, Number(item.code) || 0), 1000) + 1;
  while (await Company.exists({ code: String(next) })) next += 1;
  return String(next);
}

async function uniqueProjectCode(companyId, name) {
  return nextUniqueCode({
    seed: name,
    fallback: "PRJ",
    max: 20,
    exists: (code) => Project.exists({ companyId, code }),
  });
}

module.exports = { slugCode, uniqueCompanyCode, uniqueProjectCode };
