const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const departmentSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true, trim: true },
    /** Department function key (e.g. "engineering"). Unique per project, repeated across projects. */
    key: { type: String, required: true, trim: true, lowercase: true },
    privileges: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

departmentSchema.index({ companyId: 1, projectId: 1, key: 1 }, { unique: true });
departmentSchema.index({ companyId: 1, key: 1 });
departmentSchema.plugin(tenantGuard);

module.exports = mongoose.model("Department", departmentSchema);
