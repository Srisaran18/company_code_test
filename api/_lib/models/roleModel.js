const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const roleSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    /** Seeded roles drive the MR workflow by key; they cannot be deleted or re-keyed. */
    isSystemRole: { type: Boolean, default: false },
    privileges: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

roleSchema.index({ companyId: 1, key: 1 }, { unique: true });
roleSchema.plugin(tenantGuard);

module.exports = mongoose.model("Role", roleSchema);
