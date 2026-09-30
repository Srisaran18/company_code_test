import { WORKFLOW_ROLE_OPTIONS } from "../workflow/workflow";

/** `companyRoles` are the caller's company roles from the directory; custom ones are assignable by the company admin. */
export function assignableRoles(actorRole, companyRoles = []) {
  if (actorRole === "super_admin") {
    const known = new Set(WORKFLOW_ROLE_OPTIONS.map((item) => item.key));
    const custom = companyRoles
      .filter((role) => role.key && !known.has(role.key) && role.key !== "user")
      .map((role) => ({ key: role.key, name: role.name }));
    return [...WORKFLOW_ROLE_OPTIONS, ...custom];
  }
  if (actorRole === "admin") {
    return WORKFLOW_ROLE_OPTIONS.filter((item) => item.key === "requestor" || item.key === "admin");
  }
  return [];
}

export function usersListHref(role) {
  if (role) return `/users?role=${encodeURIComponent(role)}`;
  return "/users";
}

/** Always return to the full users list. */
export function usersHomeHref() {
  return "/users";
}

export function userCreateHref(role) {
  return role ? `/users/new?role=${encodeURIComponent(role)}` : "/users/new";
}

export function userEditHref(id) {
  return `/users/${encodeURIComponent(id)}/edit`;
}
