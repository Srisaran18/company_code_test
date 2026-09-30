const { toPublicCompany } = require("./authController");
const { FEATURES } = require("../utils/permissionCatalog");
const { httpError, sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

const PROFILE_FIELDS = ["name", "legalName", "email", "phone", "address", "country", "timezone", "currency", "logoUrl"];
const SETTING_FIELDS = ["dateFormat", "mrPrefix", "woPrefix", "poPrefix", "numberPadding"];
const DATE_FORMATS = ["DD-MM-YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY", "MMM D, YYYY"];

function validTimezone(value) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Shared by company admins (own company) and platform admins. */
function applyCompanyInput(company, body) {
  PROFILE_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    company[field] = String(body[field] ?? "").trim();
  });
  if (!String(company.name || "").trim()) throw httpError(400, "Company name is required");
  if (body.timezone !== undefined && !validTimezone(company.timezone)) throw httpError(400, "Invalid timezone");
  if (body.currency !== undefined && !/^[A-Z]{3}$/.test(String(company.currency).toUpperCase())) {
    throw httpError(400, "Currency must be a 3-letter ISO code");
  }
  const settings = body.settings || {};
  SETTING_FIELDS.forEach((field) => {
    if (settings[field] === undefined) return;
    if (field.endsWith("Prefix")) {
      const value = String(settings[field] || "").trim().toUpperCase();
      if (!/^[A-Z0-9]{1,8}$/.test(value)) throw httpError(400, `${field} must be 1-8 letters or digits`);
      company.settings[field] = value;
    } else if (field === "numberPadding") {
      const value = Number(settings[field]);
      if (!Number.isInteger(value) || value < 3 || value > 10) throw httpError(400, "numberPadding must be 3-10");
      company.settings[field] = value;
    } else if (field === "dateFormat") {
      if (!DATE_FORMATS.includes(settings[field])) throw httpError(400, "Unsupported date format");
      company.settings[field] = settings[field];
    }
  });
  company.markModified("settings");
}

const getCompany = async (req, res) => {
  try {
    const enabled = new Set(req.tenant.features);
    res.status(200).json({
      company: toPublicCompany(req.tenant.company),
      features: FEATURES.map((item) => ({ key: item.key, name: item.name, enabled: enabled.has(item.key) })),
      dateFormats: DATE_FORMATS,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateCompany = async (req, res) => {
  try {
    const company = req.tenant.company;
    applyCompanyInput(company, req.body);
    await company.save();
    await logAudit({
      action: "update",
      module: "company_settings",
      summary: `Updated company settings for ${company.name}`,
      actor: req.user,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(200).json({ message: "Company settings saved", company: toPublicCompany(company) });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { getCompany, updateCompany, applyCompanyInput, DATE_FORMATS };
