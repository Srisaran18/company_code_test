const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const counterSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    /** e.g. "MR-2026" */
    key: { type: String, required: true, trim: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true }
);

counterSchema.index({ companyId: 1, key: 1 }, { unique: true });
counterSchema.plugin(tenantGuard);

module.exports = mongoose.model("Counter", counterSchema);
