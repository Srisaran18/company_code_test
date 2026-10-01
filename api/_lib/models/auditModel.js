const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const auditSchema = new mongoose.Schema(
  {
    /** Null for platform-level events (failed login for unknown email, platform admin actions). */
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    action: { type: String, required: true, trim: true },
    module: { type: String, trim: true, default: "" },
    summary: { type: String, required: true, trim: true },
    actorId: { type: String, trim: true, default: "" },
    actorName: { type: String, trim: true, default: "" },
    actorEmail: { type: String, trim: true, default: "" },
    actorRole: { type: String, trim: true, default: "" },
    targetType: { type: String, trim: true, default: "" },
    targetId: { type: String, trim: true, default: "" },
    ip: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditSchema.index({ companyId: 1, createdAt: -1 });
auditSchema.plugin(tenantGuard);

module.exports = mongoose.model("Audit", auditSchema);
