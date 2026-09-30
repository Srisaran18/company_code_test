const mongoose = require("mongoose");
const { tenantGuard } = require("../plugins/tenantGuard");

const userSchema = new mongoose.Schema(
  {
    /** Tenant. Null only for platform admins. */
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      validate: {
        validator(value) {
          return this.isPlatformAdmin === true || Boolean(value);
        },
        message: "companyId is required for company users",
      },
    },
    isPlatformAdmin: { type: Boolean, default: false },
    name: { type: String, required: true, trim: true },
    /** Globally unique: login is by email only. */
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, required: true, default: "user" },
    department: { type: String, trim: true, lowercase: true, default: "" },
    /** Project access. allProjects grants every project in the company. */
    allProjects: { type: Boolean, default: false },
    projectIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }], default: [] },
    /** Explicit department grants. When empty, departments matching `department` key are used. */
    departmentIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }], default: [] },
    /** Every user can be chosen as a requestor until this is turned off. */
    isRequestor: { type: Boolean, default: true },
    privileges: {
      allow: { type: [String], default: [] },
      deny: { type: [String], default: [] },
    },
    /** How many users this account may create (admins with create privilege). Super Admin raises it. */
    userCreateLimit: { type: Number, default: 5, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    active: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ companyId: 1, department: 1 });
userSchema.index({ companyId: 1, role: 1 });
userSchema.plugin(tenantGuard);

module.exports = mongoose.model("User", userSchema);
