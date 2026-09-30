const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generatePassword(length = 10) {
  let value = "";
  const bytes = new Uint32Array(length);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i += 1) value += chars[bytes[i] % chars.length];
    return value;
  }
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}
