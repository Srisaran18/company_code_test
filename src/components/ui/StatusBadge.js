import { statusBadgeClass, statusDotClass } from "../../features/workflow/statusColors";

export default function StatusBadge({ value }) {
  if (!value) return null;
  const chip =
    statusBadgeClass[value] || "bg-[#e8eef4] text-[#334155] ring-1 ring-[#c5d0dc]";
  const dot = statusDotClass[value] || "bg-[#64748b]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${chip}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      {value}
    </span>
  );
}
