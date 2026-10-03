const { toPublicCompany } = require("./authController");
const { FEATURES } = require("../utils/permissionCatalog");
const { httpError, sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

const PROFILE_FIELDS = [
  "name",
  "legalName",
  "email",
  "phone",
  "address",
  "city",
  "state",
  "postalCode",
  "country",
  "taxNumber",
  "timezone",
  "currency",
  "logoUrl",
];
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
    // Name and email are fixed once they have been saved.
    if ((field === "name" || field === "email") && String(company[field] || "").trim()) return;
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

const LETTERHEAD_FIELDS = ["address", "email", "phone", "mobile", "website", "fax", "poBox", "crNumber", "vatNumber"];

function publicLetterhead(company, { includeLogo = false } = {}) {
  const source = company.letterhead || {};
  const letterhead = Object.fromEntries(LETTERHEAD_FIELDS.map((key) => [key, source[key] || ""]));
  letterhead.hasLogo = Boolean(source.logoData);
  letterhead.companyName = company.name || "";
  if (includeLogo) letterhead.logoData = source.logoData || "";
  return letterhead;
}

const getLetterhead = async (req, res) => {
  try {
    res.status(200).json({ letterhead: publicLetterhead(req.tenant.company, { includeLogo: true }) });
  } catch (error) {
    sendError(res, error);
  }
};

const updateLetterhead = async (req, res) => {
  try {
    const company = req.tenant.company;
    if (!company.letterhead) company.letterhead = {};
    LETTERHEAD_FIELDS.forEach((field) => {
      if (req.body[field] === undefined) return;
      company.letterhead[field] = String(req.body[field] ?? "").trim();
    });
    if (req.body.logoData !== undefined) {
      const logo = String(req.body.logoData || "");
      if (logo && !/^data:image\/(png|jpeg);base64,/.test(logo)) {
        return res.status(400).json({ message: "Logo must be a PNG or JPEG image" });
      }
      if (logo.length > 700000) {
        return res.status(400).json({ message: "Logo must be smaller than 500 KB" });
      }
      company.letterhead.logoData = logo;
    }
    company.markModified("letterhead");
    await company.save();
    await logAudit({
      action: "update",
      module: "company_settings",
      summary: `Updated the PDF letterhead for ${company.name}`,
      actor: req.user,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(200).json({
      message: "PDF letterhead saved",
      letterhead: publicLetterhead(company, { includeLogo: true }),
    });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getCompany,
  updateCompany,
  getLetterhead,
  updateLetterhead,
  applyCompanyInput,
  DATE_FORMATS,
};
