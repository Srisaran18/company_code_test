const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const Company = require("../models/companyModel");
const { buildCompanyCatalog, resolvePrivileges } = require("../utils/privileges");
const { enabledFeatureKeys, featureName } = require("../utils/features");
const { loadScope } = require("../utils/tenantScope");
const { sendError, httpError } = require("../utils/httpError");
const { isPlanExpired } = require("../utils/plans");

function readToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) return authHeader.split(" ")[1];
  return null;
}

/**
 * Resolves the tenant context from the database, never from the client:
 * user → company → enabled features → company-scoped privileges → project/department scope.
 */
async function loadContext(userId) {
  const user = await User.findById(userId).unscoped();
  if (!user) throw httpError(401, "User no longer exists");
  if (user.active === false) throw httpError(401, "Account is deactivated");

  if (user.isPlatformAdmin) {
    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: "platform_admin",
        department: "",
        companyId: null,
        isPlatformAdmin: true,
        privileges: {},
        allow: [],
        deny: [],
      },
      tenant: null,
      scope: null,
      record: user,
    };
  }

  if (!user.companyId) throw httpError(403, "Account is not linked to a company", "TENANT_REQUIRED");
  const company = await Company.findById(user.companyId);
  if (!company) throw httpError(403, "Company not found", "COMPANY_INACTIVE");
  if (company.status !== "active") {
    throw httpError(403, "Your company account is not active. Contact your provider.", "COMPANY_INACTIVE");
  }
  if (isPlanExpired(company)) {
    throw httpError(403, `Your company's ${company.plan.mode} has expired. Contact your provider.`, "COMPANY_PLAN_EXPIRED");
  }

  const [features, catalog, scope] = await Promise.all([
    enabledFeatureKeys(company._id),
    buildCompanyCatalog(company._id),
    loadScope(user, company._id),
  ]);

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department || "",
      companyId: company._id.toString(),
      isPlatformAdmin: false,
      privileges: resolvePrivileges(user, catalog.rolePrivileges, catalog.departmentPrivileges, features),
      allow: user.privileges?.allow || [],
      deny: user.privileges?.deny || [],
    },
    tenant: { companyId: company._id, company, features, catalog },
    scope,
    record: user,
  };
}

/** Rejects any attempt to address another company through body/query. */
function rejectForeignCompany(req) {
  const own = req.tenant ? String(req.tenant.companyId) : null;
  for (const source of [req.body, req.query]) {
    if (!source || typeof source !== "object") continue;
    for (const key of ["companyId", "company_id"]) {
      if (source[key] === undefined) continue;
      if (!own || String(source[key]) !== own) {
        throw httpError(403, "You cannot act on another company", "TENANT_MISMATCH");
      }
      delete source[key];
    }
  }
}

const authenticate = async (req, res, next) => {
  const token = readToken(req);
  if (!token) return res.status(401).json({ message: "No token provided" });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ message: "Token is not valid", error: error.message });
  }

  try {
    const context = await loadContext(decoded.userId);
    req.user = context.user;
    req.tenant = context.tenant;
    req.scope = context.scope;
    req.userRecord = context.record;
    rejectForeignCompany(req);
    const seen = context.record.lastSeenAt;
    if (!seen || Date.now() - new Date(seen).getTime() > 60 * 1000) {
      User.updateOne({ _id: context.record._id }, { $set: { lastSeenAt: new Date() } })
        .unscoped()
        .catch(() => {});
    }
    next();
  } catch (error) {
    return sendError(res, error);
  }
};

/** Company users only. This is the default guard on every tenant route. */
const verifyToken = (req, res, next) =>
  authenticate(req, res, () => {
    if (req.user.isPlatformAdmin) {
      return res.status(403).json({
        success: false,
        code: "TENANT_REQUIRED",
        message: "Platform admins cannot access company data",
      });
    }
    next();
  });

const verifyPlatformAdmin = (req, res, next) =>
  authenticate(req, res, () => {
    if (!req.user.isPlatformAdmin) {
      return res.status(403).json({ success: false, code: "PLATFORM_ADMIN_REQUIRED", message: "Platform admin only" });
    }
    next();
  });

/** Passes when any of the given features is enabled for the company. */
const requireFeature = (...featureKeys) => (req, res, next) => {
  if (featureKeys.some((key) => req.tenant?.features?.includes(key))) return next();
  return res.status(403).json({
    success: false,
    code: "FEATURE_NOT_ENABLED",
    message: `${featureName(featureKeys[0])} is not enabled for this company.`,
  });
};

/** super_admin is the company administrator: bypasses privileges, never tenant or feature checks. */
const requirePrivilege = (moduleKey, action = "view") => (req, res, next) => {
  if (req.user.role === "super_admin") return next();
  if (req.user.privileges?.[moduleKey]?.includes(action)) return next();
  return res.status(403).json({ message: `Missing privilege ${moduleKey}.${action}` });
};

const requireRoles = (...roles) => (req, res, next) => {
  if (roles.includes(req.user.role)) return next();
  return res.status(403).json({ message: "Not allowed for this role" });
};

module.exports = {
  authenticate,
  verifyToken,
  verifyPlatformAdmin,
  requireFeature,
  requirePrivilege,
  requireRoles,
  loadContext,
};
