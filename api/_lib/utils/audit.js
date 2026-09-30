const Audit = require("../models/auditModel");

async function logAudit({
  action,
  module = "",
  summary,
  actor,
  companyId,
  targetType = "",
  targetId = "",
  meta = {},
}) {
  try {
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
      meta,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
}

module.exports = { logAudit };
