const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const materialSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    productId: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    /** Denormalized project name / department key kept for existing API consumers. */
    project: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true, lowercase: true },
    unit: { type: String, trim: true, default: "" },
    /** On-hand quantity the Store department can issue. */
    stock: { type: Number, default: 0, min: 0 },
    /** Stationery is listed for every department in the company. Other products stay on their department. */
    shared: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

materialSchema.index({ companyId: 1, productId: 1 }, { unique: true });
materialSchema.index({ companyId: 1, projectId: 1, departmentId: 1, active: 1 });
materialSchema.plugin(tenantGuard);

module.exports = mongoose.model("Material", materialSchema);
