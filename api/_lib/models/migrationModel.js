const mongoose = require("mongoose");

const migrationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    appliedAt: { type: Date, default: Date.now },
    report: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Migration", migrationSchema);
