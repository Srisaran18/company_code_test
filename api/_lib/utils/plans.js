const { httpError } = require("./httpError");

const PLAN_OPTIONS = Object.freeze({
  demo: { unit: "days", durations: [5, 10, 15] },
  subscription: { unit: "months", durations: [3, 6, 9, 12] },
});

function addDuration(start, duration, unit) {
  const end = new Date(start);
  if (unit === "months") end.setMonth(end.getMonth() + duration);
  else end.setDate(end.getDate() + duration);
  return end;
}

/** Validates `{ mode, duration, startDate? }` and returns the stored plan with its end date. */
function buildPlan(input) {
  const mode = String(input?.mode || "");
  const option = PLAN_OPTIONS[mode];
  if (!option) throw httpError(400, "Plan must be demo or subscription");
  const duration = Number(input.duration);
  if (!option.durations.includes(duration)) {
    throw httpError(400, `${mode} duration must be one of ${option.durations.join(", ")} ${option.unit}`);
  }
  const startDate = input.startDate ? new Date(input.startDate) : new Date();
  if (Number.isNaN(startDate.getTime())) throw httpError(400, "Invalid plan start date");
  return { mode, duration, unit: option.unit, startDate, endDate: addDuration(startDate, duration, option.unit) };
}

function isPlanExpired(company, now = new Date()) {
  const endDate = company?.plan?.endDate;
  return Boolean(endDate && new Date(endDate) < now);
}

function toPublicPlan(plan, now = new Date()) {
  if (!plan?.mode) return null;
  const endDate = plan.endDate ? new Date(plan.endDate) : null;
  const daysLeft = endDate ? Math.max(0, Math.ceil((endDate - now) / 86400000)) : null;
  return {
    mode: plan.mode,
    duration: plan.duration,
    unit: plan.unit,
    startDate: plan.startDate || null,
    endDate,
    daysLeft,
    expired: Boolean(endDate && endDate < now),
  };
}

module.exports = { PLAN_OPTIONS, buildPlan, isPlanExpired, toPublicPlan };
