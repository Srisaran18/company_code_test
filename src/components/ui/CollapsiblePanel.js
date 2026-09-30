import { useCallback, useState } from "react";
import GlassPanel from "./GlassPanel";

function readStored(storageKey) {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}") || {};
  } catch {
    return {};
  }
}

/** Open/closed state per section id, remembered in localStorage. Sections default to open. */
export function useCollapsibleSections(storageKey) {
  const [collapsed, setCollapsed] = useState(() => readStored(storageKey));

  const persist = useCallback(
    (next) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable: keep in-memory state only
      }
      return next;
    },
    [storageKey]
  );

  const isOpen = useCallback((id) => !collapsed[id], [collapsed]);
  const toggle = useCallback(
    (id) => setCollapsed((prev) => persist({ ...prev, [id]: !prev[id] })),
    [persist]
  );
  const setAll = useCallback(
    (ids, open) => setCollapsed(() => persist(Object.fromEntries(ids.map((id) => [id, !open])))),
    [persist]
  );

  return { isOpen, toggle, setAll };
}

export function SectionToolbar({ ids, sections }) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        className="rounded-full border border-brand-blue/40 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10"
        onClick={() => sections.setAll(ids, false)}
      >
        Minimize all
      </button>
      <button
        type="button"
        className="rounded-full border border-brand-blue/40 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10"
        onClick={() => sections.setAll(ids, true)}
      >
        Maximize all
      </button>
    </div>
  );
}

export default function CollapsiblePanel({ title, subtitle, actions, open, onToggle, children, className = "" }) {
  return (
    <GlassPanel as="article" className={`p-5 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={open}
          onClick={onToggle}
        >
          <span
            className={`mt-1.5 inline-block text-xs text-brand-blue transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          >
            ▶
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-semibold">{title}</span>
            {subtitle ? <span className="block text-sm text-white/50">{subtitle}</span> : null}
          </span>
        </button>
        <div className="flex items-center gap-2">
          {open ? actions : null}
          <button
            type="button"
            className="rounded-full border border-brand-blue/40 px-3 py-1 text-xs font-semibold text-brand-blue hover:bg-brand-blue/10"
            onClick={onToggle}
          >
            {open ? "Minimize" : "Maximize"}
          </button>
        </div>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </GlassPanel>
  );
}
