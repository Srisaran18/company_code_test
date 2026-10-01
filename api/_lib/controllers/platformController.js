const bcrypt = require("bcryptjs");
const Company = require("../models/companyModel");
const Feature = require("../models/featureModel");
const CompanyFeature = require("../models/companyFeatureModel");
const User = require("../models/userModel");
const Audit = require("../models/auditModel");
const { provisionCompany, syncFeatures } = require("../data/seed");
const { applyCompanyInput } = require("./companyController");
const { toPublicCompany } = require("./authController");
const { toPublicAudit } = require("./auditController");
const { ALWAYS_ON_FEATURES, modulesForFeature } = require("../utils/permissionCatalog");
const { isValidId, toId } = require("../utils/tenantScope");
const { generatePassword } = require("../utils/privileges");
const { uniqueCompanyCode } = require("../utils/codes");
const { sendAdminWelcome } = require("../utils/mailer");
const { PLAN_OPTIONS, buildPlan, isPlanExpired } = require("../utils/plans");
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
      modules: modulesForFeature(feature.key),
    };
  });
}

/** Aligns every feature's dates with the plan window. Which features are ticked is left to the platform admin. */
async function applyPlanToFeatures(companyId, plan) {
  await syncFeatures();
  const features = await Feature.find();
  for (const feature of features) {
    const alwaysOn = ALWAYS_ON_FEATURES.includes(feature.key);
    await CompanyFeature.updateOne(
      { companyId, featureId: feature._id },
      {
        $set: {
          featureKey: feature.key,
          startDate: alwaysOn ? null : plan.startDate,
          endDate: alwaysOn ? null : plan.endDate,
        },
        $setOnInsert: { enabled: alwaysOn },
      },
      { upsert: true }
    );
  }
}

async function companyAdmins(companyId) {
  const admins = await User.find({ companyId, role: "super_admin" })
    .select("name email active password")
    .sort({ name: 1 });
  return admins.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    email: item.email,
    active: item.active !== false,
    password: item.password || "",
  }));
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
    res.status(200).json({
      company: toPublicCompany(company),
      features: await companyFeatures(company._id),
      admins: await companyAdmins(company._id),
    });
  } catch (error) {
    sendError(res, error);
  }
};

/** Creates the company, its own system roles, its subscriptions and (optionally) its first admin. */
const createCompany = async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) throw httpError(400, "Company name is required");
    let code = String(req.body.code || "").trim().toUpperCase();
    if (!code) code = await uniqueCompanyCode();
    if (!/^\d{2,20}$/.test(code)) throw httpError(400, "Company code must be 2-20 digits");
    if (await Company.exists({ code })) throw httpError(409, "Company code already exists");
    const plan = buildPlan(req.body.plan);
    const admin = req.body.admin || {};
    const adminName = String(admin.name || "").trim();
    const adminEmail = String(admin.email || "").toLowerCase().trim();
    if (!adminName) throw httpError(400, "Super Admin name is required");
    if (!adminEmail) throw httpError(400, "Super Admin email is required");
    if (admin.password && String(admin.password).length < 6) {
      throw httpError(400, "Super Admin password must be at least 6 characters");
    }
    if (await User.exists({ email: adminEmail }).unscoped()) {
      throw httpError(409, "Admin email already in use");
    }

    const draft = new Company({ code, name });
    applyCompanyInput(draft, req.body);
    const company = await provisionCompany(
      { ...draft.toObject(), code, name, plan, status: req.body.status || "active" },
      { featureKeys: Array.isArray(req.body.features) ? req.body.features : [] }
    );
    await applyPlanToFeatures(company._id, plan);

    let adminPassword = null;
    let adminPasswordEmailed = false;
    if (adminEmail) {
      adminPassword = admin.password && String(admin.password).length >= 6 ? admin.password : generatePassword(12);
      const adminUser = {
        name: adminName,
        email: adminEmail,
      };
      await User.create({
        companyId: company._id,
        name: adminUser.name,
        email: adminUser.email,
        password: await bcrypt.hash(adminPassword, 10),
        role: "super_admin",
        allProjects: true,
        active: true,
      });
      const mailed = await sendAdminWelcome({ company, admin: adminUser, password: adminPassword });
      adminPasswordEmailed = mailed.sent === true;
    }
    await logAudit({
      action: "create",
      module: "platform",
      summary: `Created company ${company.code} (${plan.mode} ${plan.duration} ${plan.unit})`,
      actor: req.user,
      companyId: null,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(201).json({
      message: "Company created",
      company: toPublicCompany(company),
      features: await companyFeatures(company._id),
      admins: await companyAdmins(company._id),
      adminPassword,
      adminPasswordEmailed,
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
    if (req.body.plan !== undefined) company.plan = buildPlan(req.body.plan);
    await company.save();
    if (req.body.plan !== undefined) await applyPlanToFeatures(company._id, company.plan);
    const planNote = req.body.plan
      ? `, ${company.plan.mode} ${company.plan.duration} ${company.plan.unit}`
      : "";
    await logAudit({
      action: "update",
      module: "platform",
      summary: `Updated company ${company.code} (${company.status}${planNote})`,
      actor: req.user,
      companyId: null,
      targetType: "company",
      targetId: company._id.toString(),
    });
    res.status(200).json({
      message: "Company updated",
      company: toPublicCompany(company),
      features: await companyFeatures(company._id),
    });
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
      const planDates = item.enabled === true && company.plan?.mode ? company.plan : {};
      const startDate = item.startDate ? new Date(item.startDate) : planDates.startDate || null;
      const endDate = item.endDate ? new Date(item.endDate) : planDates.endDate || null;
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
        modules: modulesForFeature(item.key),
      })),
      planOptions: PLAN_OPTIONS,
      nextCompanyCode: await uniqueCompanyCode(),
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

const listCompanyAudits = async (req, res) => {
  try {
    const company = await loadCompany(req.params.id);
    const query = String(req.query.q || req.query.search || "").trim();
    const limit = Math.min(Number(req.query.limit) || (query ? 2000 : 500), 2000);
    const filter = {
      $or: [{ companyId: company._id }, { companyId: null, targetType: "company", targetId: company._id.toString() }],
    };
    if (req.query.module) filter.module = String(req.query.module);
    if (req.query.action) filter.action = String(req.query.action);
    if (query) {
      const pattern = new RegExp(String(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$and = [{ $or: [{ actorName: pattern }, { actorEmail: pattern }, { summary: pattern }] }];
    }
    const rows = await Audit.find(filter).unscoped().sort({ createdAt: -1 }).limit(limit);
    res.status(200).json({ audits: rows.map(toPublicAudit) });
  } catch (error) {
    sendError(res, error);
  }
};

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const today = startOfDay(now);
    const onlineSince = new Date(now.getTime() - 5 * 60 * 1000);
    const days = 14;
    const since = startOfDay(new Date(today.getTime() - (days - 1) * 86400000));

    const [companies, users, audits] = await Promise.all([
      Company.find().lean(),
      User.find({}).unscoped().select("name email active lastSeenAt companyId isPlatformAdmin role").lean(),
      Audit.find({ createdAt: { $gte: since } }).unscoped().select("companyId action actorRole actorEmail createdAt").lean(),
    ]);

    const companyName = Object.fromEntries(companies.map((item) => [String(item._id), item.name]));
    const online = users.filter((item) => item.active !== false && item.lastSeenAt && new Date(item.lastSeenAt) >= onlineSince);
    const activeToday = users.filter((item) => item.active !== false && item.lastSeenAt && new Date(item.lastSeenAt) >= today);
    const usedToday = new Set(
      audits.filter((item) => new Date(item.createdAt) >= today && item.companyId).map((item) => String(item.companyId))
    );

    const usageMap = {};
    for (let i = 0; i < days; i += 1) {
      const day = new Date(since.getTime() + i * 86400000);
      usageMap[dayKey(day)] = { name: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }), logins: 0, actions: 0, companies: new Set() };
    }
    audits.forEach((item) => {
      const bucket = usageMap[dayKey(item.createdAt)];
      if (!bucket) return;
      bucket.actions += 1;
      if (item.action === "login") bucket.logins += 1;
      if (item.companyId) bucket.companies.add(String(item.companyId));
    });

    const activityByCompany = {};
    audits
      .filter((item) => new Date(item.createdAt) >= today && item.companyId)
      .forEach((item) => {
        const id = String(item.companyId);
        activityByCompany[id] = (activityByCompany[id] || 0) + 1;
      });

    const expiringSoon = companies
      .filter((item) => item.plan?.endDate && !isPlanExpired(item) && new Date(item.plan.endDate) - now < 7 * 86400000)
      .map((item) => ({
        id: item._id.toString(),
        name: item.name,
        code: item.code,
        plan: item.plan.mode,
        endDate: item.plan.endDate,
        daysLeft: Math.max(0, Math.ceil((new Date(item.plan.endDate) - now) / 86400000)),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    res.status(200).json({
      kpis: {
        usersOnline: online.filter((item) => !item.isPlatformAdmin).length,
        usersActiveToday: activeToday.filter((item) => !item.isPlatformAdmin).length,
        usersTotal: users.filter((item) => item.companyId).length,
        platformAdminsOnline: online.filter((item) => item.isPlatformAdmin).length,
        companiesActive: companies.filter((item) => item.status === "active").length,
        companiesUsedToday: usedToday.size,
        companiesTotal: companies.length,
        companiesSuspended: companies.filter((item) => item.status === "suspended").length,
        companiesDemo: companies.filter((item) => item.plan?.mode === "demo" && !isPlanExpired(item)).length,
        companiesSubscription: companies.filter((item) => item.plan?.mode === "subscription" && !isPlanExpired(item)).length,
        companiesExpired: companies.filter((item) => isPlanExpired(item)).length,
      },
      usageByDay: Object.values(usageMap).map((item) => ({
        name: item.name,
        logins: item.logins,
        actions: item.actions,
        companies: item.companies.size,
      })),
      companiesByPlan: [
        { name: "Demo", value: companies.filter((item) => item.plan?.mode === "demo" && !isPlanExpired(item)).length },
        { name: "Subscription", value: companies.filter((item) => item.plan?.mode === "subscription" && !isPlanExpired(item)).length },
        { name: "Expired", value: companies.filter((item) => isPlanExpired(item)).length },
        { name: "No plan", value: companies.filter((item) => !item.plan?.mode).length },
      ].filter((item) => item.value > 0),
      activityByCompany: Object.entries(activityByCompany)
        .map(([id, value]) => ({ name: companyName[id] || id, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
      onlineUsers: online.slice(0, 12).map((item) => ({
        id: item._id.toString(),
        name: item.name,
        email: item.email,
        role: item.isPlatformAdmin ? "platform_admin" : item.role,
        company: item.isPlatformAdmin ? "Platform" : companyName[String(item.companyId)] || "",
        lastSeenAt: item.lastSeenAt,
      })),
      expiringSoon,
    });
  } catch (error) {
    sendError(res, error);
  }
};

const listAllAudits = async (req, res) => {
  try {
    const query = String(req.query.q || req.query.search || "").trim();
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    const [allCompanies, platformAdmins] = await Promise.all([
      Company.find().select("name code").sort({ name: 1 }).lean(),
      User.find({ isPlatformAdmin: true }).unscoped().select("email name").lean(),
    ]);
    const platformEmails = platformAdmins.map((item) => item.email);
    const filter = {};
    const extras = [];

    const companyParam = String(req.query.company || "").trim();
    if (companyParam === "platform") {
      extras.push({ $or: [{ companyId: null }, { actorRole: "platform_admin" }, { actorEmail: { $in: platformEmails } }] });
    } else if (companyParam && isValidId(companyParam)) {
      extras.push({ companyId: toId(companyParam) });
    }

    const actorParam = String(req.query.actor || "").trim();
    if (actorParam === "platform") {
      extras.push({ $or: [{ actorRole: "platform_admin" }, { actorEmail: { $in: platformEmails } }] });
    } else if (actorParam === "company") {
      extras.push({ actorRole: { $nin: ["platform_admin"] }, actorEmail: { $nin: platformEmails } });
    }

    if (req.query.module) filter.module = String(req.query.module);
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.from) {
      const from = startOfDay(req.query.from);
      if (!Number.isNaN(from.getTime())) filter.createdAt = { ...(filter.createdAt || {}), $gte: from };
    }
    if (req.query.until) {
      const until = endOfDay(req.query.until);
      if (!Number.isNaN(until.getTime())) filter.createdAt = { ...(filter.createdAt || {}), $lte: until };
    }

    if (query) {
      const pattern = new RegExp(escapeRegex(query), "i");
      const matchingIds = allCompanies
        .filter((item) => pattern.test(item.name) || pattern.test(item.code))
        .map((item) => item._id);
      extras.push({
        $or: [
          { actorName: pattern },
          { actorEmail: pattern },
          { summary: pattern },
          { action: pattern },
          { module: pattern },
          { actorRole: pattern },
          { ip: pattern },
          { userAgent: pattern },
          ...(matchingIds.length ? [{ companyId: { $in: matchingIds } }] : []),
        ],
      });
    }

    if (extras.length) filter.$and = extras;
    const rows = await Audit.find(filter).unscoped().sort({ createdAt: -1 }).limit(limit);
    const names = Object.fromEntries(allCompanies.map((item) => [String(item._id), `${item.name} (${item.code})`]));
    const modules = [...new Set(rows.map((item) => item.module).filter(Boolean))].sort();
    const actions = [...new Set(rows.map((item) => item.action).filter(Boolean))].sort();

    res.status(200).json({
      audits: rows.map((item) => {
        const isPlatformActor =
          item.actorRole === "platform_admin" || platformEmails.includes(item.actorEmail);
        return {
          ...toPublicAudit(item),
          company: item.companyId ? names[String(item.companyId)] || "" : "Platform",
          companyId: item.companyId ? String(item.companyId) : "",
          isPlatformActor,
          who: isPlatformActor ? "Platform admin" : item.actorRole || "User",
        };
      }),
      companies: allCompanies.map((item) => ({ id: item._id.toString(), name: item.name, code: item.code })),
      modules,
      actions,
    });
  } catch (error) {
    sendError(res, error);
  }
};

/** Replaces a company Super Admin password. The stored value is always the bcrypt hash. */
const resetAdminPassword = async (req, res) => {
  try {
    const company = await loadCompany(req.params.id);
    if (!isValidId(req.params.userId)) throw httpError(404, "Super Admin not found");
    const password = String(req.body.password || "");
    if (password.length < 6) throw httpError(400, "Password must be at least 6 characters");
    const user = await User.findOne({
      _id: toId(req.params.userId),
      companyId: company._id,
      role: "super_admin",
    });
    if (!user) throw httpError(404, "Super Admin not found");
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    await logAudit({
      action: "update",
      module: "platform",
      summary: `Reset Super Admin password for ${user.email} (${company.code})`,
      actor: req.user,
      companyId: null,
      targetType: "user",
      targetId: user._id.toString(),
    });
    const admin = (await companyAdmins(company._id)).find((item) => item.id === user._id.toString());
    res.status(200).json({ message: "Password updated", admin });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  resetAdminPassword,
  setFeatures,
  listFeatures,
  updateFeature,
  listCompanyAudits,
  listAllAudits,
  getDashboard,
};
