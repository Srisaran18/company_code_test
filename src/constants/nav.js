export const modules = {
  dashboard: { to: "/", label: "Dashboard", icon: "home" },
  material_requests: { to: "/material-requests", label: "Material Requests", icon: "clipboard" },
  attendance: { to: "/attendance", label: "Attendance", icon: "calendar" },
  approvals: { to: "/approvals", label: "Approvals", icon: "check" },
  procurement: { to: "/procurement", label: "Procurement", icon: "layers" },
  purchase_orders: { to: "/purchase-orders", label: "Purchase Orders", icon: "cart" },
  deliveries: { to: "/deliveries", label: "Deliveries", icon: "truck" },
  payments: { to: "/payments", label: "Payments", icon: "card" },
  suppliers: { to: "/suppliers", label: "Suppliers", icon: "store" },
  users: { to: "/users", label: "Users", icon: "users" },
  projects: { to: "/projects", label: "Projects", icon: "layers" },
  departments: { to: "/departments", label: "Departments", icon: "building" },
  materials: { to: "/materials", label: "Materials", icon: "box" },
  roles: { to: "/roles", label: "Roles", icon: "badge" },
  privileges: { to: "/privileges", label: "Privileges", icon: "key" },
  delete_requests: { to: "/delete-requests", label: "Delete Requests", icon: "trash" },
  reports: { to: "/reports", label: "Reports", icon: "chart" },
  settings: { to: "/settings", label: "Settings", icon: "cog" },
  company_settings: { to: "/company", label: "Company", icon: "building" },
  audits: { to: "/audits", label: "Audits", icon: "list" },
};

/** Platform admins manage tenants only; they never see company modules. */
export const platformNavItems = [{ key: "platform", to: "/platform", label: "Companies", icon: "building" }];

export const menuGroups = [
  { id: "workspace", label: "Workspace", items: ["dashboard"] },
  {
    id: "admin",
    label: "Admin",
    items: ["users", "projects", "departments", "materials", "privileges", "roles", "delete_requests", "reports", "audits", "company_settings", "settings"],
  },
  { id: "request", label: "Request", items: ["material_requests", "approvals", "attendance"] },
  { id: "sourcing", label: "Sourcing", items: ["procurement", "suppliers"] },
  { id: "ordering", label: "Ordering", items: ["purchase_orders"] },
  { id: "fulfilment", label: "Delivery & payment", items: ["deliveries", "payments"] },
];

/** Sidebar parent that nests the material workflow pages. */
export const MATERIAL_FLOW_KEYS = [
  "material_requests",
  "approvals",
  "procurement",
  "purchase_orders",
  "deliveries",
  "payments",
  "suppliers",
];

const SUPER_ADMIN_ORDER = [
  "dashboard",
  "attendance",
  "material_flow",
  "users",
  "projects",
  "departments",
  "materials",
  "privileges",
  "roles",
  "delete_requests",
  "audits",
  "company_settings",
];

const REQUESTOR_MENU_KEYS = ["material_requests", "attendance", "settings"];

/**
 * Menu visibility follows the company's subscription (UX only; the API enforces it).
 * `catalog` is the server's permission catalog: { moduleKey: { feature, actions } }.
 */
export function isModuleEnabled(key, features, catalog) {
  if (!Array.isArray(features) || !features.length) return true;
  const feature = catalog?.[key]?.feature;
  return !feature || features.includes(feature);
}

function canViewModule(key, privileges, roleKey, features, catalog) {
  if (!isModuleEnabled(key, features, catalog)) return false;
  if (key === "attendance") return true;
  if (
    roleKey === "super_admin" &&
    ["projects", "departments", "roles", "privileges", "audits", "materials", "company_settings"].includes(key)
  ) {
    return true;
  }
  return Boolean(privileges?.[key]?.includes("view"));
}

export function flattenNavItems(items = []) {
  return items.flatMap((item) => (item.children?.length ? item.children : [item]));
}

export function getNavItems(privileges, roleKey, features, catalog) {
  if (roleKey === "platform_admin") return platformNavItems;
  const isRequestor = roleKey === "user" || roleKey === "requestor" || roleKey === "requester";
  if (isRequestor) {
    return REQUESTOR_MENU_KEYS.filter(
      (key) =>
        canViewModule(key, privileges, roleKey, features, catalog) ||
        (key === "material_requests" && isModuleEnabled(key, features, catalog))
    ).map((key) => ({ key, ...modules[key] }));
  }

  const allowed = Object.entries(modules)
    .filter(([key]) => canViewModule(key, privileges, roleKey, features, catalog))
    .map(([key, item]) => ({ key, ...item }));

  const byKey = Object.fromEntries(allowed.map((item) => [item.key, item]));
  const workflowChildren = MATERIAL_FLOW_KEYS.map((key) => byKey[key]).filter(Boolean);
  const rest = allowed.filter((item) => !MATERIAL_FLOW_KEYS.includes(item.key));

  const items = [];
  let flowInserted = false;

  rest.forEach((item) => {
    items.push(item);
    if (item.key === "dashboard" && workflowChildren.length) {
      items.push({
        key: "material_flow",
        label: "Material Flow",
        icon: "flow",
        to: workflowChildren[0].to,
        children: workflowChildren,
      });
      flowInserted = true;
    }
  });

  if (!flowInserted && workflowChildren.length) {
    items.unshift({
      key: "material_flow",
      label: "Material Flow",
      icon: "flow",
      to: workflowChildren[0].to,
      children: workflowChildren,
    });
  }

  if (roleKey !== "super_admin") return items;

  return [...items].sort((a, b) => {
    const left = SUPER_ADMIN_ORDER.indexOf(a.key);
    const right = SUPER_ADMIN_ORDER.indexOf(b.key);
    const aRank = left === -1 ? SUPER_ADMIN_ORDER.length : left;
    const bRank = right === -1 ? SUPER_ADMIN_ORDER.length : right;
    return aRank - bRank;
  });
}

export function getModuleByPath(pathname) {
  return (
    Object.entries(modules).find(([, item]) => item.to === pathname)?.[0] ||
    null
  );
}

export function homePathForRole(roleKey) {
  if (roleKey === "platform_admin") return "/platform";
  if (roleKey === "user" || roleKey === "requestor" || roleKey === "requester") {
    return "/material-requests";
  }
  if (roleKey === "supplier") return "/purchase-orders";
  if (roleKey === "manager" || roleKey === "department_head") return "/approvals";
  if (roleKey === "procurement") return "/procurement";
  if (roleKey === "finance") return "/payments";
  if (roleKey === "in_charge") return "/deliveries";
  if (roleKey === "back_office") return "/materials";
  return "/";
}
