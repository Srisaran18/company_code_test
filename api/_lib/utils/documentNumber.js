const Counter = require("../models/counterModel");

const PREFIX_SETTING = { MR: "mrPrefix", WO: "woPrefix", PO: "poPrefix" };

/**
 * Atomic per-company document number, e.g. MR-2026-000001.
 * Numbering is tenant-specific, so uniqueness is (companyId, number).
 */
async function nextDocumentNumber(company, type, date = new Date()) {
  const settings = company.settings || {};
  const prefix = String(settings[PREFIX_SETTING[type]] || type).trim().toUpperCase() || type;
  const padding = Number(settings.numberPadding) || 6;
  const year = date.getFullYear();
  const key = `${prefix}-${year}`;

  let counter;
  try {
    counter = await Counter.findOneAndUpdate(
      { companyId: company._id, key },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (error) {
    // Two first-of-year requests can race on the upsert; the loser retries against the new doc.
    if (error.code !== 11000) throw error;
    counter = await Counter.findOneAndUpdate(
      { companyId: company._id, key },
      { $inc: { seq: 1 } },
      { returnDocument: "after" }
    );
  }
  return `${key}-${String(counter.seq).padStart(padding, "0")}`;
}

module.exports = { nextDocumentNumber };
