import { useMemo } from "react";
import { useSelector } from "react-redux";
import { isModuleEnabled, modules } from "../../constants/nav";
import { PRIVILEGE_ACTIONS } from "../../constants/privileges";

function isOn(map, moduleKey, action) {
  return Boolean(map?.[moduleKey]?.includes(action));
}

function toKey(moduleKey, action) {
  return `${moduleKey}.${action}`;
}

export function effectivePrivileges(roleMap = {}, custom = { allow: [], deny: [] }) {
  const next = JSON.parse(JSON.stringify(roleMap || {}));
  (custom.allow || []).forEach((item) => {
    const [moduleKey, action] = String(item).split(".");
    if (!moduleKey || !action) return;
    if (!next[moduleKey]) next[moduleKey] = [];
    if (!next[moduleKey].includes(action)) next[moduleKey].push(action);
  });
  (custom.deny || []).forEach((item) => {
    const [moduleKey, action] = String(item).split(".");
    if (!moduleKey || !action || !next[moduleKey]) return;
    next[moduleKey] = next[moduleKey].filter((value) => value !== action);
    if (next[moduleKey].length === 0) delete next[moduleKey];
  });
  return next;
}

function moduleKeysForRole(defaults = {}, custom = { allow: [] }, showAll = false) {
  if (showAll) return Object.keys(modules);
  const keys = new Set(Object.keys(defaults || {}).filter((key) => (defaults[key] || []).length));
  (custom.allow || []).forEach((item) => {
    const [moduleKey] = String(item).split(".");
    if (moduleKey) keys.add(moduleKey);
  });
  return Object.keys(modules).filter((key) => keys.has(key));
}

export default function RolePrivilegePicker({
  roleKey,
  rolePrivileges,
  mode,
  onModeChange,
  custom,
  onCustomChange,
  showAllModules = false,
}) {
  const features = useSelector((state) => state.auth.features);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const defaults = useMemo(() => rolePrivileges?.[roleKey] || {}, [roleKey, rolePrivileges]);
  const current = mode === "custom" ? effectivePrivileges(defaults, custom) : defaults;
  const moduleKeys = moduleKeysForRole(
    defaults,
    mode === "custom" ? custom : { allow: [] },
    showAllModules && mode === "custom"
  ).filter((key) => isModuleEnabled(key, features, catalog));
  const catalogActions = (moduleKey) => catalog?.[moduleKey]?.actions || PRIVILEGE_ACTIONS;
  const readOnly = mode === "default";

  const toggle = (moduleKey, action) => {
    if (readOnly) return;
    const key = toKey(moduleKey, action);
    const allow = new Set(custom?.allow || []);
    const deny = new Set(custom?.deny || []);
    const inDefault = isOn(defaults, moduleKey, action);
    const on = isOn(current, moduleKey, action);

    if (on) {
      if (inDefault) {
        deny.add(key);
        allow.delete(key);
      } else {
        allow.delete(key);
        deny.delete(key);
      }
    } else if (inDefault) {
      deny.delete(key);
      allow.delete(key);
    } else {
      allow.add(key);
      deny.delete(key);
    }

    onCustomChange({
      allow: Array.from(allow),
      deny: Array.from(deny),
    });
  };

  return (
    <div className="sm:col-span-2 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Privileges</p>
          <p className="text-sm text-white/50">
            {moduleKeys.length
              ? `Access for the ${roleKey.replaceAll("_", " ")} role.`
              : "Select a role to see its privileges."}
          </p>
        </div>
        <div className="inline-flex rounded-2xl border border-white/15 bg-white/5 p-1">
          {[
            { id: "default", label: "Default" },
            { id: "custom", label: "Custom" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`rounded-xl px-3 py-1.5 text-sm ${
                mode === item.id ? "bg-brand-blue text-white" : "text-white/70 hover:bg-white/10"
              }`}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {moduleKeys.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/55">
          This role has no privileges yet.
        </p>
      ) : (
        <div className="space-y-3 rounded-[22px] border border-white/10 bg-white/5 p-4">
          {moduleKeys.map((moduleKey) => {
            const defaultActions = defaults[moduleKey] || [];
            const shownActions = readOnly && !showAllModules ? defaultActions : catalogActions(moduleKey);
            return (
              <div key={moduleKey}>
                <p className="mb-1.5 text-sm font-medium">{modules[moduleKey]?.label || moduleKey}</p>
                <div className="flex flex-wrap gap-2">
                  {shownActions.map((action) => {
                    const checked = (current[moduleKey] || []).includes(action);
                    const extra = (custom?.allow || []).includes(toKey(moduleKey, action));
                    const removed = (custom?.deny || []).includes(toKey(moduleKey, action));
                    return (
                      <button
                        key={action}
                        type="button"
                        disabled={readOnly}
                        onClick={() => toggle(moduleKey, action)}
                        className={`rounded-full px-2.5 py-1 text-xs ${
                          checked ? "bg-brand-blue text-white" : "border border-white/10 text-white/55"
                        } ${readOnly ? "cursor-default" : ""}`}
                      >
                        {action}
                        {mode === "custom" && extra ? " +" : ""}
                        {mode === "custom" && removed ? " −" : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
