/**
 * Global definitions. Roles store `{ moduleKey: [actions] }` per company;
 * this catalog decides which module/action pairs exist and which paid feature owns each module.
 */

const FEATURES = Object.freeze([
  { key: "core", name: "Core CAFM", description: "Users, roles, projects, departments, settings, audits", alwaysOn: true },
  { key: "material_requests", name: "Material Requests", description: "Material catalogue, MRs and approvals" },
  { key: "procurement", name: "Procurement", description: "Sourcing, RFQ, quotations, purchase orders, deliveries, payments" },
  { key: "supplier_management", name: "Supplier Management", description: "Supplier directory" },
  { key: "reports", name: "Reports", description: "Standard reports" },
  { key: "advanced_reports", name: "Advanced Reports", description: "Advanced analytics" },
  { key: "asset_management", name: "Asset Management", description: "Asset register" },
  { key: "work_orders", name: "Work Orders", description: "Reactive maintenance work orders" },
  { key: "preventive_maintenance", name: "Preventive Maintenance", description: "Planned maintenance schedules" },
  { key: "inventory", name: "Inventory", description: "Stock and stores" },
]);

const FEATURE_KEYS = FEATURES.map((item) => item.key);
const ALWAYS_ON_FEATURES = FEATURES.filter((item) => item.alwaysOn).map((item) => item.key);

const MODULES = Object.freeze({
  dashboard: { feature: "core", actions: ["view"] },
  attendance: { feature: "core", actions: ["view"] },
  users: { feature: "core", actions: ["view", "create", "edit", "delete"] },
  roles: { feature: "core", actions: ["view", "create", "edit", "delete"] },
  privileges: { feature: "core", actions: ["view", "create", "edit", "delete"] },
  projects: { feature: "core", actions: ["view", "create", "edit", "delete"] },
  departments: { feature: "core", actions: ["view", "create", "edit", "delete"] },
  delete_requests: { feature: "core", actions: ["view", "approve", "reject"] },
  audits: { feature: "core", actions: ["view"] },
  settings: { feature: "core", actions: ["view", "edit"] },
  company_settings: { feature: "core", actions: ["view", "edit"] },
  material_requests: { feature: "material_requests", actions: ["view", "create", "edit", "delete"] },
  approvals: { feature: "material_requests", actions: ["view", "approve", "reject"] },
  materials: { feature: "material_requests", actions: ["view", "create", "edit", "delete"] },
  procurement: { feature: "procurement", actions: ["view", "create", "edit"] },
  purchase_orders: { feature: "procurement", actions: ["view", "create", "edit"] },
  deliveries: { feature: "procurement", actions: ["view", "edit"] },
  payments: { feature: "procurement", actions: ["view", "approve"] },
  suppliers: { feature: "supplier_management", actions: ["view", "create", "edit", "delete"] },
  reports: { feature: "reports", actions: ["view", "export"] },
});

function featureForModule(moduleKey) {
  return MODULES[moduleKey]?.feature || null;
}

/** Drops unknown modules/actions. Throws with statusCode 400 when `strict`. */
function sanitizePrivilegeMap(map, { strict = false } = {}) {
  const next = {};
  Object.entries(map || {}).forEach(([moduleKey, actions]) => {
    const definition = MODULES[moduleKey];
    if (!definition) {
      if (strict) throw Object.assign(new Error(`Unknown permission module "${moduleKey}"`), { statusCode: 400 });
      return;
    }
    const list = [...new Set((Array.isArray(actions) ? actions : []).map(String))];
    const invalid = list.filter((action) => !definition.actions.includes(action));
    if (invalid.length && strict) {
      throw Object.assign(new Error(`Unknown permission ${moduleKey}.${invalid[0]}`), { statusCode: 400 });
    }
    const valid = list.filter((action) => definition.actions.includes(action));
    if (valid.length) next[moduleKey] = valid;
  });
  return next;
}

function sanitizePermissionList(list, { strict = false } = {}) {
  return [...new Set((Array.isArray(list) ? list : []).map(String))].filter((item) => {
    const [moduleKey, action] = item.split(".");
    const ok = Boolean(MODULES[moduleKey]?.actions.includes(action));
    if (!ok && strict) throw Object.assign(new Error(`Unknown permission ${item}`), { statusCode: 400 });
    return ok;
  });
}

/** Removes modules whose feature is not enabled for the company. */
function filterPrivilegesByFeatures(map, enabledFeatures) {
  const enabled = new Set(enabledFeatures || []);
  return Object.fromEntries(
    Object.entries(map || {}).filter(([moduleKey]) => enabled.has(featureForModule(moduleKey)))
  );
}

module.exports = {
  FEATURES,
  FEATURE_KEYS,
  ALWAYS_ON_FEATURES,
  MODULES,
  featureForModule,
  sanitizePrivilegeMap,
  sanitizePermissionList,
  filterPrivilegesByFeatures,
};
