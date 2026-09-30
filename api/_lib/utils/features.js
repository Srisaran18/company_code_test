const Feature = require("../models/featureModel");
const CompanyFeature = require("../models/companyFeatureModel");
const { ALWAYS_ON_FEATURES, FEATURES } = require("./permissionCatalog");

function isActiveWindow(entry, now = new Date()) {
  if (!entry.enabled) return false;
  if (entry.startDate && entry.startDate > now) return false;
  if (entry.endDate && entry.endDate < now) return false;
  return true;
}

/** Feature keys the company may use right now (subscription + global status + dates). */
async function enabledFeatureKeys(companyId) {
  const [entries, inactive] = await Promise.all([
    CompanyFeature.find({ companyId }),
    Feature.find({ status: "inactive" }).select("key"),
  ]);
  const disabledGlobally = new Set(inactive.map((item) => item.key));
  const keys = new Set(ALWAYS_ON_FEATURES);
  entries.forEach((entry) => {
    if (isActiveWindow(entry) && !disabledGlobally.has(entry.featureKey)) keys.add(entry.featureKey);
  });
  return FEATURES.map((item) => item.key).filter((key) => keys.has(key));
}

function featureName(key) {
  return FEATURES.find((item) => item.key === key)?.name || key;
}

module.exports = { enabledFeatureKeys, featureName, isActiveWindow };
