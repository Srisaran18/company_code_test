const FALLBACK_TIMEZONES = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Riyadh",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
];

export function timezoneOptions() {
  const values =
    typeof Intl !== "undefined" && typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;
  return values.map((value) => ({ value, label: value.replace(/_/g, " ") }));
}
