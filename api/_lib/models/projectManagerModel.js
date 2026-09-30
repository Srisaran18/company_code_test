const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const projectManagerSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
    project: { type: String, required: true, trim: true },
    projectKey: { type: String, required: true, trim: true, lowercase: true },
    department: { type: String, required: true, trim: true, lowercase: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    managerName: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

projectManagerSchema.index({ companyId: 1, projectId: 1, departmentId: 1 }, { unique: true });
projectManagerSchema.plugin(tenantGuard);

module.exports = mongoose.model("ProjectManager", projectManagerSchema);
