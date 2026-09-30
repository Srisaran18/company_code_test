export function loadJson(key) {
  try {
    const local = localStorage.getItem(key);
    const session = sessionStorage.getItem(key);
    const raw = local || session;
    if (raw && !local) localStorage.setItem(key, raw);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  sessionStorage.removeItem(key);
}

export function clearJson(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}
