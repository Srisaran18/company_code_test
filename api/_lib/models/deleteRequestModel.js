const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const deleteRequestSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    targetType: { type: String, required: true, enum: ["user"], default: "user" },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    targetSnapshot: {
      name: String,
      email: String,
      role: String,
    },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewNote: { type: String, default: "" },
    reviewedAt: Date,
  },
  { timestamps: true }
);

deleteRequestSchema.index({ companyId: 1, targetId: 1, status: 1 });
deleteRequestSchema.plugin(tenantGuard);

module.exports = mongoose.model("DeleteRequest", deleteRequestSchema);
