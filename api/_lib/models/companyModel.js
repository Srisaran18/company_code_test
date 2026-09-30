const mongoose = require("mongoose");

const COMPANY_STATUSES = ["active", "suspended", "inactive"];

const companySettingsSchema = new mongoose.Schema(
  {
    dateFormat: { type: String, trim: true, default: "DD-MM-YYYY" },
    mrPrefix: { type: String, trim: true, uppercase: true, default: "MR" },
    woPrefix: { type: String, trim: true, uppercase: true, default: "WO" },
    poPrefix: { type: String, trim: true, uppercase: true, default: "PO" },
    /** Digits in the running part of document numbers, e.g. 6 → MR-2026-000001. */
    numberPadding: { type: Number, min: 3, max: 10, default: 6 },
  },
  { _id: false }
);

const companyPlanSchema = new mongoose.Schema(
  {
    mode: { type: String, enum: ["demo", "subscription"] },
    duration: { type: Number },
    unit: { type: String, enum: ["days", "months"] },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { _id: false }
);

const companySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    /** ISO 3166-1 alpha-2 code, e.g. "SA". */
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
    taxNumber: { type: String, trim: true, default: "" },
    timezone: { type: String, trim: true, default: "UTC" },
    currency: { type: String, trim: true, uppercase: true, default: "USD" },
    logoUrl: { type: String, trim: true, default: "" },
    status: { type: String, enum: COMPANY_STATUSES, default: "active" },
    settings: { type: companySettingsSchema, default: () => ({}) },
    /** Access window. Companies without a plan (created before plans existed) have no expiry. */
    plan: { type: companyPlanSchema, default: undefined },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
module.exports.COMPANY_STATUSES = COMPANY_STATUSES;
