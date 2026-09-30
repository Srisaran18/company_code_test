const bcrypt = require("bcryptjs");
const Company = require("../models/companyModel");
const Feature = require("../models/featureModel");
const CompanyFeature = require("../models/companyFeatureModel");
const User = require("../models/userModel");
const { provisionCompany, syncFeatures } = require("../data/seed");
const { applyCompanyInput } = require("./companyController");
const { toPublicCompany } = require("./authController");
const { ALWAYS_ON_FEATURES } = require("../utils/permissionCatalog");
const { isValidId, toId } = require("../utils/tenantScope");
const { generatePassword } = require("../utils/privileges");
const { httpError, sendError } = require("../utils/httpError");
const { logAudit } = require("../utils/audit");

async function companyFeatures(companyId) {
  const [features, entries] = await Promise.all([Feature.find().sort({ name: 1 }), CompanyFeature.find({ companyId })]);
  const byKey = new Map(entries.map((item) => [item.featureKey, item]));
  return features.map((feature) => {
    const entry = byKey.get(feature.key);
    return {
      key: feature.key,
      name: feature.name,
      globalStatus: feature.status,
      alwaysOn: ALWAYS_ON_FEATURES.includes(feature.key),
      enabled: ALWAYS_ON_FEATURES.includes(feature.key) || Boolean(entry?.enabled),
      startDate: entry?.startDate || null,
      endDate: entry?.endDate || null,
    };
  });
}

async function loadCompany(id) {
  if (!isValidId(id)) throw httpError(404, "Company not found");
  const company = await Company.findById(toId(id));
  if (!company) throw httpError(404, "Company not found");
  return company;
}

const listCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 });
    const counts = await User.aggregate([
      { $match: { companyId: { $in: companies.map((item) => item._id) } } },
      { $group: { _id: "$companyId", users: { $sum: 1 } } },
    ]);
    const usersBy = Object.fromEntries(counts.map((item) => [String(item._id), item.users]));
    res.status(200).json({
      companies: companies.map((item) => ({ ...toPublicCompany(item), users: usersBy[String(item._id)] || 0 })),
    });
  } catch (error) {
    sendError(res, error);
  }
};

const getCompany = async (req, res) => {
  try {
    const company = await loadCompany(req.params.id);
    res.status(200).json({ company: toPublicCompany(company), features: await companyFeatures(company._id) });
  } catch (error) {
    sendError(res, error);
  }
};

/** Creates the company, its own system roles, its subscriptions and (optionally) its first admin. */
const createCompany = async (req, res) => {
  try {
    const code = String(req.body.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(code)) throw httpError(400, "Company code must be 2-20 letters, digits, - or _");
    if (await Company.exists({ code })) throw httpError(409, "Company code already exists");
    const admin = req.body.admin || null;
    if (admin?.email && (await User.exists({ email: String(admin.email).toLowerCase().trim() }).unscoped())) {
      throw httpError(409, "Admin email already in use");
    }

    const draft = new Company({ code, name: req.body.name || code });
    applyCompanyInput(draft, req.body);
    const company = await provisionCompany(
      { ...draft.toObject(), code, status: req.body.status || "active" },
      { featureKeys: Array.isArray(req.body.features) ? req.body.features : [] }
    );

    let adminPassword = null;
    if (admin?.email) {
      adminPassword = admin.password && String(admin.password).length >= 6 ? admin.password : generatePassword(12);
      await User.create({
        companyId: company._id,
        name: admin.name || "Company Admin",
        email: String(admin.email).toLowerCase().trim(),
        password: await bcrypt.hash(adminPassword, 10),
        role: "super_admin",
        allProjects: true,
        active: true,
      });
    }
    await logAudit({
      action: "create",
      module: "platform",
      summary: `Created company ${company.code}`,
      actor: req.user,
      companyId: null,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(201).json({
      message: "Company created",
      company: toPublicCompany(company),
      features: await companyFeatures(company._id),
      adminPassword,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateCompany = async (req, res) => {
  try {
    const company = await loadCompany(req.params.id);
    applyCompanyInput(company, req.body);
    if (req.body.status !== undefined) {
      if (!Company.COMPANY_STATUSES.includes(req.body.status)) throw httpError(400, "Invalid status");
      company.status = req.body.status;
    }
    await company.save();
    await logAudit({
      action: "update",
      module: "platform",
      summary: `Updated company ${company.code} (${company.status})`,
      actor: req.user,
      companyId: null,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(200).json({ message: "Company updated", company: toPublicCompany(company) });
  } catch (error) {
    sendError(res, error);
  }
};

/** Body: { features: [{ key, enabled, startDate?, endDate? }] } */
const setFeatures = async (req, res) => {
  try {
    const company = await loadCompany(req.params.id);
    const input = Array.isArray(req.body.features) ? req.body.features : [];
    const features = await Feature.find({ key: { $in: input.map((item) => String(item.key)) } });
    const byKey = new Map(features.map((item) => [item.key, item]));
    for (const item of input) {
      const feature = byKey.get(String(item.key));
      if (!feature) throw httpError(400, `Unknown feature ${item.key}`);
      const startDate = item.startDate ? new Date(item.startDate) : null;
      const endDate = item.endDate ? new Date(item.endDate) : null;
      if ((startDate && Number.isNaN(startDate.getTime())) || (endDate && Number.isNaN(endDate.getTime()))) {
        throw httpError(400, `Invalid dates for ${item.key}`);
      }
      await CompanyFeature.updateOne(
        { companyId: company._id, featureId: feature._id },
        {
          $set: {
            featureKey: feature.key,
            enabled: ALWAYS_ON_FEATURES.includes(feature.key) ? true : item.enabled === true,
            startDate,
            endDate,
          },
        },
        { upsert: true }
      );
    }
    await logAudit({
      action: "update",
      module: "platform",
      summary: `Updated features for ${company.code}`,
      actor: req.user,
      companyId: null,
      targetType: "company",
      targetId: company._id.toString(),
      meta: { features: input },
    });
    res.status(200).json({ message: "Features updated", features: await companyFeatures(company._id) });
  } catch (error) {
    sendError(res, error);
  }
};

const listFeatures = async (req, res) => {
  try {
    await syncFeatures();
    const features = await Feature.find().sort({ name: 1 });
    res.status(200).json({
      features: features.map((item) => ({
        id: item._id.toString(),
        key: item.key,
        name: item.name,
        description: item.description,
        status: item.status,
        alwaysOn: ALWAYS_ON_FEATURES.includes(item.key),
      })),
    });
  } catch (error) {
    sendError(res, error);
  }
};

const updateFeature = async (req, res) => {
  try {
    const feature = await Feature.findOne({ key: String(req.params.key) });
    if (!feature) throw httpError(404, "Feature not found");
    if (req.body.status !== undefined) {
      if (!["active", "inactive"].includes(req.body.status)) throw httpError(400, "Invalid status");
      if (ALWAYS_ON_FEATURES.includes(feature.key) && req.body.status !== "active") {
        throw httpError(400, "Core cannot be disabled");
      }
      feature.status = req.body.status;
    }
    if (req.body.name) feature.name = String(req.body.name).trim();
    if (req.body.description !== undefined) feature.description = String(req.body.description).trim();
    await feature.save();
    res.status(200).json({ message: "Feature updated" });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { listCompanies, getCompany, createCompany, updateCompany, setFeatures, listFeatures, updateFeature };
