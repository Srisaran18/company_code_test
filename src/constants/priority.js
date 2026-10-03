export const PRIORITIES = [
  { value: "P1", label: "P1 — Urgent" },
  { value: "P2", label: "P2 — High" },
  { value: "P3", label: "P3 — Normal" },
];

export function priorityLabel(value) {
  return PRIORITIES.find((item) => item.value === value)?.label || value || "";
}
