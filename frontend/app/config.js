export function getApiBase() {
  const explicit = window.PROFITSTACK_API_BASE || localStorage.getItem('profitstack_api_base');
  if (explicit) return explicit.replace(/\/$/, '');

  // Local dev: static app is often `python -m http.server 8788` while the API
  // runs on 8787 (see root package.json). Same-origin `/api/*` would 404.
  if (window.location.port === '8788') {
    return `${window.location.protocol}//${window.location.hostname}:8787`.replace(/\/$/, '');
  }

  return window.location.origin.replace(/\/$/, '');
}

/** Absolute URL for API routes (respects getApiBase). */
export function apiUrl(path) {
  const base = getApiBase();
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

export async function fetchFrontendConfig() {
  const res = await fetch(apiUrl('/api/frontend-config'));
  if (!res.ok) throw new Error(`Frontend config failed with ${res.status}`);
  return res.json();
}
