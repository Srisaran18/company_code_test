const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const projectSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    /** Lowercased, trimmed name. Matches the legacy free-text project matching. */
    key: { type: String, required: true, trim: true, lowercase: true },
    code: { type: String, trim: true, uppercase: true, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

projectSchema.index({ companyId: 1, key: 1 }, { unique: true });
projectSchema.plugin(tenantGuard);

module.exports = mongoose.model("Project", projectSchema);
