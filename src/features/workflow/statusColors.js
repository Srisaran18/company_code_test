/** Soft status chips — readable on light (theme-rest) and dark surfaces. */
export const statusBadgeClass = {
  Draft: "bg-[#e8eef4] text-[#334155] ring-1 ring-[#c5d0dc]",
  Requested: "bg-[#dbeafe] text-[#1d4ed8] ring-1 ring-[#93c5fd]",
  "Pending Approval": "bg-[#dbeafe] text-[#1d4ed8] ring-1 ring-[#93c5fd]",
  Returned: "bg-[#ffedd5] text-[#c2410c] ring-1 ring-[#fdba74]",
  Rejected: "bg-[#fee2e2] text-[#b91c1c] ring-1 ring-[#fca5a5]",
  Approved: "bg-[#d1fae5] text-[#047857] ring-1 ring-[#6ee7b7]",
  Sourcing: "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#c4b5fd]",
  "In Procurement": "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#c4b5fd]",
  "RFQ Issued": "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#c4b5fd]",
  "Pending Commercial": "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#c4b5fd]",
  "Pending Finance": "bg-[#ede9fe] text-[#6d28d9] ring-1 ring-[#c4b5fd]",
  "Pending PO": "bg-[#dbeafe] text-[#1e40af] ring-1 ring-[#93c5fd]",
  Ordered: "bg-[#dbeafe] text-[#1e40af] ring-1 ring-[#93c5fd]",
  "PO Issued": "bg-[#dbeafe] text-[#1e40af] ring-1 ring-[#93c5fd]",
  "PO Rejected": "bg-[#fee2e2] text-[#b91c1c] ring-1 ring-[#fca5a5]",
  "In transit": "bg-[#fef3c7] text-[#b45309] ring-1 ring-[#fcd34d]",
  "In Delivery": "bg-[#fef3c7] text-[#b45309] ring-1 ring-[#fcd34d]",
  Arriving: "bg-[#ffedd5] text-[#c2410c] ring-1 ring-[#fdba74]",
  "Pending Receipt": "bg-[#ffedd5] text-[#c2410c] ring-1 ring-[#fdba74]",
  Discrepancy: "bg-[#ffedd5] text-[#c2410c] ring-1 ring-[#fdba74]",
  Delivered: "bg-[#ccfbf1] text-[#0f766e] ring-1 ring-[#5eead4]",
  Closed: "bg-[#ccfbf1] text-[#0f766e] ring-1 ring-[#5eead4]",
  Pending: "bg-[#fef3c7] text-[#b45309] ring-1 ring-[#fcd34d]",
  Open: "bg-[#dbeafe] text-[#1d4ed8] ring-1 ring-[#93c5fd]",
  Released: "bg-[#ccfbf1] text-[#0f766e] ring-1 ring-[#5eead4]",
  "Not started": "bg-[#e8eef4] text-[#334155] ring-1 ring-[#c5d0dc]",
};

export const statusDotClass = {
  Draft: "bg-[#64748b]",
  Requested: "bg-[#2563eb]",
  "Pending Approval": "bg-[#2563eb]",
  Returned: "bg-[#ea580c]",
  Rejected: "bg-[#dc2626]",
  Approved: "bg-[#059669]",
  Sourcing: "bg-[#7c3aed]",
  "In Procurement": "bg-[#7c3aed]",
  "RFQ Issued": "bg-[#7c3aed]",
  "Pending Commercial": "bg-[#7c3aed]",
  "Pending Finance": "bg-[#7c3aed]",
  "Pending PO": "bg-[#1d4ed8]",
  Ordered: "bg-[#1d4ed8]",
  "PO Issued": "bg-[#1d4ed8]",
  "PO Rejected": "bg-[#dc2626]",
  "In transit": "bg-[#d97706]",
  "In Delivery": "bg-[#d97706]",
  Arriving: "bg-[#ea580c]",
  "Pending Receipt": "bg-[#ea580c]",
  Discrepancy: "bg-[#ea580c]",
  Delivered: "bg-[#0d9488]",
  Closed: "bg-[#0d9488]",
  Pending: "bg-[#d97706]",
  Open: "bg-[#2563eb]",
  Released: "bg-[#0d9488]",
  "Not started": "bg-[#64748b]",
};

export const stageColors = {
  Draft: {
    done: "border-slate-500 bg-slate-500 text-white",
    current: "border-slate-500 bg-slate-500 text-white shadow-[0_0_0_6px_rgba(100,116,139,0.25)]",
    line: "bg-slate-400",
    text: "text-slate-600",
  },
  Requested: {
    done: "border-sky-500 bg-sky-500 text-white",
    current: "border-sky-500 bg-sky-500 text-white shadow-[0_0_0_6px_rgba(14,165,233,0.28)]",
    line: "bg-sky-400",
    text: "text-sky-700",
  },
  Returned: {
    done: "border-orange-500 bg-orange-500 text-white",
    current: "border-orange-500 bg-orange-500 text-white shadow-[0_0_0_6px_rgba(249,115,22,0.28)]",
    line: "bg-orange-400",
    text: "text-orange-700",
  },
  Approved: {
    done: "border-emerald-500 bg-emerald-500 text-white",
    current: "border-emerald-500 bg-emerald-500 text-white shadow-[0_0_0_6px_rgba(16,185,129,0.28)]",
    line: "bg-emerald-400",
    text: "text-emerald-700",
  },
  Sourcing: {
    done: "border-violet-500 bg-violet-500 text-white",
    current: "border-violet-500 bg-violet-500 text-white shadow-[0_0_0_6px_rgba(139,92,246,0.28)]",
    line: "bg-violet-400",
    text: "text-violet-700",
  },
  Ordered: {
    done: "border-brand-blue bg-brand-blue text-white",
    current: "border-brand-blue bg-brand-blue text-white shadow-[0_0_0_6px_rgba(4,114,223,0.28)]",
    line: "bg-brand-blue",
    text: "text-brand-blue",
  },
  "In transit": {
    done: "border-amber-500 bg-amber-500 text-white",
    current: "border-amber-500 bg-amber-500 text-white shadow-[0_0_0_6px_rgba(245,158,11,0.28)]",
    line: "bg-amber-400",
    text: "text-amber-700",
  },
  Arriving: {
    done: "border-orange-500 bg-orange-500 text-white",
    current: "border-orange-500 bg-orange-500 text-white shadow-[0_0_0_6px_rgba(249,115,22,0.28)]",
    line: "bg-orange-400",
    text: "text-orange-700",
  },
  Delivered: {
    done: "border-brand-teal bg-brand-teal text-white",
    current: "border-brand-teal bg-brand-teal text-white shadow-[0_0_0_6px_rgba(4,167,147,0.28)]",
    line: "bg-brand-teal",
    text: "text-brand-teal",
  },
};

export function firstStepColor(status) {
  if (status === "Draft") return stageColors.Draft;
  if (status === "Returned") return stageColors.Returned;
  return stageColors.Requested;
}
