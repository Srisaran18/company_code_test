export function codeFromName(name, fallback = "CO") {
  const cleaned = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 12);
  if (cleaned.length >= 2) return cleaned;
  return `${cleaned}${fallback}`.replace(/[^A-Z0-9]/g, "").slice(0, 12);
}
