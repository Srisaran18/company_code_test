export const PLAN_OPTIONS = {
  demo: { label: "Demo", unit: "days", durations: [5, 10, 15] },
  subscription: { label: "Subscription", unit: "months", durations: [3, 6, 9, 12] },
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

/** e.g. "Demo · 10 days · 7 days left" or "Subscription · 6 months · Expired". */
export function planSummary(plan) {
  if (!plan?.mode) return "No plan";
  const label = PLAN_OPTIONS[plan.mode]?.label || plan.mode;
  const status = plan.expired ? "Expired" : `${plan.daysLeft} days left`;
  return `${label} · ${plan.duration} ${plan.unit} · ${status}`;
}

/** Colored plan label with days left and the end date. Demo is amber, subscription is teal. */
export function PlanChip({ plan, className = "" }) {
  if (!plan?.mode) return null;
  const tone = plan.expired
    ? "bg-red-500 text-white"
    : plan.mode === "demo"
      ? "bg-amber-500 text-white"
      : "bg-brand-teal text-white";
  const label = plan.mode === "demo" ? "Demo" : "Subscription";
  const left = plan.expired ? "Expired" : `${plan.daysLeft} days left`;
  const until = formatDate(plan.endDate);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tone} ${className}`}>
      {label} · {left}
      {until ? ` · until ${until}` : ""}
    </span>
  );
}

export function planRange(plan) {
  if (!plan?.mode) return "";
  return `${formatDate(plan.startDate)} → ${formatDate(plan.endDate)}`;
}

function dateOnly(value) {
  return value ? String(value).slice(0, 10) : null;
}

/** Ticked features without dates take the company's plan window. */
export function withPlanDates(features, plan) {
  if (!plan?.mode) return features;
  return features.map((item) =>
    item.alwaysOn || !item.enabled
      ? item
      : {
          ...item,
          startDate: item.startDate || dateOnly(plan.startDate),
          endDate: item.endDate || dateOnly(plan.endDate),
        }
  );
}

export function PlanPicker({ value, onChange }) {
  const option = PLAN_OPTIONS[value.mode];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {Object.entries(PLAN_OPTIONS).map(([mode, item]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ mode, duration: item.durations[0] })}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              value.mode === mode ? "bg-brand-blue text-white" : "border border-white/15 text-white/70 hover:bg-white/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {option.durations.map((duration) => (
          <button
            key={duration}
            type="button"
            onClick={() => onChange({ ...value, duration })}
            className={`rounded-xl px-3 py-1.5 text-sm transition ${
              value.duration === duration
                ? "bg-brand-teal text-white"
                : "border border-white/15 text-white/70 hover:bg-white/10"
            }`}
          >
            {duration} {option.unit}
          </button>
        ))}
      </div>
    </div>
  );
}
