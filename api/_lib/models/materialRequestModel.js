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
    /** Quantity already handed out by the Store. Pending is requested minus this. */
    issuedQty: { type: Number, default: 0, min: 0 },
    /** Quantity the Store manually handed to the purchase process. */
    poQty: { type: Number, default: 0, min: 0 },
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
    location: { type: String, trim: true, default: "" },
    region: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    justification: { type: String, trim: true, default: "" },
    /** P1 Urgent, P2 High, P3 Normal. */
    priority: { type: String, enum: ["P1", "P2", "P3"], default: "P3" },
    products: { type: [productSchema], default: [] },
    quantity: { type: String, trim: true, default: "" },
    amount: { type: Number, default: 0 },
    supplier: { type: String, trim: true, default: "" },
    quotation: { type: String, trim: true, default: "" },
    status: { type: String, default: "Draft" },
    /** True from manager approval until the Store has issued the full quantity. */
    storeOpen: { type: Boolean, default: false },
    /** True only after the Store user chooses to send the shortage to purchase. */
    purchaseSent: { type: Boolean, default: false },
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
