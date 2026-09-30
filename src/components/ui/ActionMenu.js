import { useEffect, useRef, useState } from "react";

const tones = {
  edit: "text-sky-200",
  approve: "text-brand-teal",
  reject: "text-red-300",
  delete: "text-red-300",
};

export default function ActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const options = items.filter(Boolean);

  useEffect(() => {
    const onClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!options.length) return <span className="text-xs text-white/40">—</span>;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        className="rounded-2xl border border-white/15 bg-white/8 px-3 py-1.5 text-sm hover:bg-white/12"
        onClick={() => setOpen((value) => !value)}
      >
        Actions
      </button>
      {open ? (
        <div className="glass absolute right-0 z-30 mt-1 min-w-[10rem] overflow-hidden rounded-2xl py-1">
          {options.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${tones[item.tone] || "text-white/80"}`}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
