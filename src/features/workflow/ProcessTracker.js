import { firstStepColor, stageColors } from "./statusColors";

const headlines = {
  Draft: "Draft request",
  Requested: "Waiting for department manager",
  Returned: "Returned for revision",
  Approved: "Manager approved · procurement queue",
  Rejected: "Request was rejected",
  Sourcing: "Procurement sourcing",
  "RFQ Issued": "Quotes requested from suppliers",
  "Pending Commercial": "Department head commercial approval",
  "Pending Finance": "Finance budget approval",
  "Pending PO": "Ready for purchase order",
  Ordered: "PO issued",
  "PO Rejected": "Supplier rejected PO",
  "In transit": "Supplier dispatch",
  "Pending Receipt": "Awaiting site receipt",
  Discrepancy: "Delivery discrepancy",
  Delivered: "Material accepted",
  Closed: "MR closed",
};

const steps = [
  {
    label: "Request",
    hint: "Create / submit",
    match: ["Draft", "Requested", "Returned"],
    colorKey: "Requested",
  },
  {
    label: "Business",
    hint: "Dept manager",
    match: ["Approved", "Rejected"],
    colorKey: "Approved",
  },
  {
    label: "Sourcing",
    hint: "RFQ / recommend",
    match: ["Sourcing", "RFQ Issued", "Pending Commercial", "Pending Finance", "Pending PO"],
    colorKey: "Sourcing",
  },
  {
    label: "Order",
    hint: "PO issued",
    match: ["Ordered", "PO Rejected"],
    colorKey: "Ordered",
  },
  {
    label: "Delivery",
    hint: "In transit",
    match: ["In transit"],
    colorKey: "In transit",
  },
  {
    label: "Receipt",
    hint: "In-charge verify",
    match: ["Pending Receipt", "Discrepancy"],
    colorKey: "Arriving",
  },
  {
    label: "Closed",
    hint: "Complete",
    match: ["Delivered", "Closed"],
    colorKey: "Delivered",
  },
];

const failed = ["Rejected", "PO Rejected"];
const warning = ["Returned", "Discrepancy"];
const awaitingApproval = ["Requested", "Pending Commercial", "Pending Finance", "Pending PO"];


function stepColor(step, status) {
  if (step.colorKey === "Requested") return firstStepColor(status);
  return stageColors[step.colorKey] || stageColors.Requested;
}

function activeStepIndex(status) {
  if (awaitingApproval.includes(status)) return 1;
  const current = steps.findIndex((step) => step.match.includes(status));
  return current < 0 ? 0 : current;
}

function stepState(status, index) {
  const active = activeStepIndex(status);
  if (status === "Delivered" || status === "Closed") return "done";
  if (index < active) return "done";
  if (index === active) {
    if (failed.includes(status)) return "failed";
    if (warning.includes(status)) return "warn";
    if (awaitingApproval.includes(status)) return "waiting";
    return "current";
  }
  return "todo";
}

function stepHint(step, status, state) {
  if (step.label === "Business" && status === "Requested") {
    return "Waiting for manager";
  }
  if (step.label === "Request" && status === "Requested") {
    return "Sent · next: manager";
  }
  if (step.label === "Sourcing" && awaitingApproval.includes(status)) {
    return headlines[status] || step.hint;
  }
  return step.hint;
}

const fallbackRing = {
  failed: "border-red-700 bg-red-700 text-white",
  warn: "border-orange-700 bg-orange-700 text-white",
  waiting:
    "border-emerald-600 bg-emerald-700 text-white shadow-[0_0_0_6px_rgba(4,120,87,0.35)] animate-pulse",
  todo: "border-white/20 bg-white/10 text-white/50",
};

const fallbackLine = {
  failed: "bg-red-700",
  warn: "bg-orange-600",
  waiting: "bg-emerald-600",
  todo: "bg-white/15",
};

function ringClass(step, state, status) {
  if (state === "done" || state === "current") return stepColor(step, status)[state];
  if (state === "waiting") return fallbackRing.waiting;
  return fallbackRing[state];
}

function lineClass(step, state, status) {
  if (state === "done" || state === "current") return stepColor(step, status).line;
  if (state === "waiting") return fallbackLine.waiting;
  return fallbackLine[state];
}

function labelClass(step, state, status) {
  if (state === "todo") return "text-white/40";
  if (state === "waiting") return "text-emerald-200";
  return stepColor(step, status).text;
}

function connectorState(fromState, toState) {
  if (toState === "todo") return "todo";
  if (fromState === "done" && (toState === "waiting" || toState === "current")) return "waiting";
  return "done";
}

export default function ProcessTracker({ status }) {
  const currentIndex = activeStepIndex(status);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">Process status</p>
          <h2 className="mt-1 text-xl font-semibold">{headlines[status] || status}</h2>
        </div>
        <p className="text-sm text-white/55">
          Step {Math.min(currentIndex + 1, steps.length)} of {steps.length}
        </p>
      </div>

      <div className="mt-6 hidden md:block">
        <div className="flex items-start">
          {steps.map((step, index) => {
            const state = stepState(status, index);
            const nextState = index < steps.length - 1 ? stepState(status, index + 1) : null;
            return (
              <div key={step.label} className="flex min-w-0 flex-1 flex-col items-center">
                <div className="flex w-full items-center">
                  <div
                    className={`h-1 flex-1 rounded-full ${
                      index === 0
                        ? "bg-transparent"
                        : lineClass(
                            steps[index - 1] || step,
                            connectorState(stepState(status, index - 1), state),
                            status
                          )
                    }`}
                  />
                  <div
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${ringClass(step, state, status)}`}
                  >
                    {state === "done" ? "✓" : state === "failed" ? "!" : index + 1}
                    {state === "waiting" || (state === "done" && nextState === "waiting") ? (
                      <span className="pointer-events-none absolute -right-3 top-1/2 hidden -translate-y-1/2 text-emerald-300 sm:block">
                        →
                      </span>
                    ) : null}
                  </div>
                  <div
                    className={`h-1 flex-1 rounded-full ${
                      index === steps.length - 1
                        ? "bg-transparent"
                        : lineClass(step, connectorState(state, nextState), status)
                    }`}
                  />
                </div>
                <p className={`mt-2 text-center text-xs font-semibold ${labelClass(step, state, status)}`}>
                  {step.label}
                </p>
                <p className="mt-0.5 text-center text-[11px] text-white/40">
                  {stepHint(step, status, state)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <ol className="mt-5 space-y-0 md:hidden">
        {steps.map((step, index) => {
          const state = stepState(status, index);
          const nextState = index < steps.length - 1 ? stepState(status, index + 1) : null;
          return (
            <li key={step.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${ringClass(step, state, status)}`}
                >
                  {state === "done" ? "✓" : state === "failed" ? "!" : index + 1}
                </div>
                {index < steps.length - 1 ? (
                  <div
                    className={`my-1 w-0.5 flex-1 min-h-[1.25rem] ${lineClass(
                      step,
                      connectorState(state, nextState),
                      status
                    )}`}
                  />
                ) : null}
              </div>
              <div className="pb-4">
                <p className={`text-sm font-semibold ${labelClass(step, state, status)}`}>
                  {step.label}
                  {state === "waiting" ? " →" : ""}
                </p>
                <p className="text-xs text-white/45">{stepHint(step, status, state)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
