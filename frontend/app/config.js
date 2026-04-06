export function getApiBase() {
  const explicit = window.PROFITSTACK_API_BASE || localStorage.getItem('profitstack_api_base');
  if (explicit) return explicit.replace(/\/$/, '');

  const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
  if (isLocal) return 'http://127.0.0.1:8787';

  return window.location.origin;
}
