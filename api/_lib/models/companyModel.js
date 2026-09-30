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

const companySchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    legalName: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    timezone: { type: String, trim: true, default: "UTC" },
    currency: { type: String, trim: true, uppercase: true, default: "USD" },
    logoUrl: { type: String, trim: true, default: "" },
    status: { type: String, enum: COMPANY_STATUSES, default: "active" },
    settings: { type: companySettingsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
module.exports.COMPANY_STATUSES = COMPANY_STATUSES;
