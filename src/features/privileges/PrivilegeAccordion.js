import { useState } from "react";
import { useSelector } from "react-redux";
import { isModuleEnabled, modules } from "../../constants/nav";
import { PRIVILEGE_ACTIONS, togglePrivilege } from "../../constants/privileges";

const ACTION_LABELS = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  export: "Export",
  approve: "Approve",
  reject: "Reject",
};

function Chevron({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
    </svg>
  );
}

export default function PrivilegeAccordion({
  groups,
  current,
  canChange,
  onChange,
  filterModules,
}) {
  const [openGroup, setOpenGroup] = useState(groups[0]?.id || "");
  const [openModule, setOpenModule] = useState("");
  const features = useSelector((state) => state.auth.features);
  const catalog = useSelector((state) => state.auth.permissionCatalog);
  const actionsFor = (moduleKey) => catalog?.[moduleKey]?.actions || PRIVILEGE_ACTIONS;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {groups.map((group) => {
        const items = group.items
          .filter((key) => modules[key])
          .filter((key) => isModuleEnabled(key, features, catalog))
          .filter((key) => (filterModules ? filterModules(key) : true));
        if (!items.length) return null;
        const groupOpen = openGroup === group.id;
        const groupEnabled = items.reduce(
          (sum, key) => sum + (current[key]?.length || 0),
          0
        );

        return (
          <div key={group.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/5">
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3.5 text-left"
              onClick={() => {
                setOpenGroup(groupOpen ? "" : group.id);
                setOpenModule("");
              }}
            >
              <span>
                <span className="block text-sm font-semibold">{group.label}</span>
                <span className="mt-0.5 block text-xs text-white/45">
                  {groupEnabled ? `${groupEnabled} actions on` : "No access yet"}
                </span>
              </span>
              <Chevron open={groupOpen} />
            </button>

            {groupOpen ? (
              <div className="space-y-1 border-t border-white/10 px-2 pb-2 pt-1">
                {items.map((moduleKey) => {
                  const module = modules[moduleKey];
                  const moduleOpen = openModule === moduleKey;
                  const selectedActions = current[moduleKey] || [];
                  return (
                    <div key={moduleKey} className="rounded-xl bg-white/5">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm"
                        onClick={() => setOpenModule(moduleOpen ? "" : moduleKey)}
                      >
                        <span className="font-medium">{module.label}</span>
                        <span className="flex items-center gap-2 text-xs text-white/45">
                          {selectedActions.length || "—"}
                          <Chevron open={moduleOpen} />
                        </span>
                      </button>
                      {moduleOpen ? (
                        <div className="flex flex-wrap gap-2 px-3 pb-3">
                          {actionsFor(moduleKey).map((action) => {
                            const checked = selectedActions.includes(action);
                            return (
                              <button
                                key={action}
                                type="button"
                                disabled={!canChange}
                                onClick={() => onChange(togglePrivilege(current, moduleKey, action))}
                                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                  checked
                                    ? "bg-brand-blue text-white shadow-[0_4px_12px_rgba(4,114,223,0.28)]"
                                    : "border border-white/15 bg-white text-[#5c7388] hover:border-brand-blue/40 hover:text-brand-blue"
                                } ${!canChange ? "cursor-default opacity-70" : ""}`}
                              >
                                {ACTION_LABELS[action] || action}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
