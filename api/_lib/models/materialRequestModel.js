const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const productSchema = new mongoose.Schema(
  {
    productId: { type: String, trim: true, uppercase: true, default: "" },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    quantity: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const materialRequestSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    /** Null only on legacy MRs created before department was required. */
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },
    /** Unique per company: two tenants may both have MR-2026-000001. */
    mrNo: { type: String, required: true, trim: true },
    project: { type: String, required: true, trim: true },
    requestedBy: { type: String, required: true, trim: true },
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: String, trim: true, default: "" },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: String, trim: true, default: "" },
    assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    department: { type: String, trim: true, default: "" },
    justification: { type: String, trim: true, default: "" },
    products: { type: [productSchema], default: [] },
    quantity: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0 },
    supplier: { type: String, trim: true, default: "" },
    quotation: { type: String, trim: true, default: "" },
    status: { type: String, default: "Draft" },
    paymentStatus: { type: String, default: "Not started" },
    date: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

materialRequestSchema.index({ companyId: 1, mrNo: 1 }, { unique: true });
materialRequestSchema.index({ companyId: 1, projectId: 1, departmentId: 1, status: 1 });
materialRequestSchema.index({ companyId: 1, createdAt: -1 });
materialRequestSchema.plugin(tenantGuard);

module.exports = mongoose.model("MaterialRequest", materialRequestSchema);
