const { AsyncLocalStorage } = require("async_hooks");
const Audit = require("../models/auditModel");

const auditContext = new AsyncLocalStorage();

function clientIp(req) {
  if (!req) return "";
  const forwarded = req.headers?.["x-forwarded-for"] || req.headers?.["X-Forwarded-For"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  const raw = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "";
  return String(raw).replace(/^::ffff:/, "");
}

function bindAuditRequest(req, next) {
  auditContext.run({ req }, next);
}

async function logAudit({
  action,
  module = "",
  summary,
  actor,
  companyId,
  targetType = "",
  targetId = "",
  meta = {},
  req,
  ip,
  userAgent,
}) {
  try {
    const request = req || auditContext.getStore()?.req;
    const resolvedIp = ip || clientIp(request);
    const resolvedUa = userAgent || request?.headers?.["user-agent"] || "";
    await Audit.create({
      companyId: companyId || actor?.companyId || null,
      action,
      module,
      summary,
      actorId: actor?.id || actor?._id?.toString?.() || "",
      actorName: actor?.name || "",
      actorEmail: actor?.email || "",
      actorRole: actor?.isPlatformAdmin ? "platform_admin" : actor?.role || "",
      targetType,
      targetId: targetId ? String(targetId) : "",
      ip: resolvedIp,
      userAgent: resolvedUa,
      meta,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}

module.exports = { logAudit, bindAuditRequest, clientIp };
