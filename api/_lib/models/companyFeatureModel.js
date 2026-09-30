const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const companyFeatureSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    featureId: { type: mongoose.Schema.Types.ObjectId, ref: "Feature", required: true },
    featureKey: { type: String, required: true, trim: true, lowercase: true },
    enabled: { type: Boolean, default: true },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

companyFeatureSchema.index({ companyId: 1, featureId: 1 }, { unique: true });
companyFeatureSchema.index({ companyId: 1, featureKey: 1 });
companyFeatureSchema.plugin(tenantGuard);

module.exports = mongoose.model("CompanyFeature", companyFeatureSchema);
