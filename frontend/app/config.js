export function getApiBase() {
  const explicit = window.PROFITSTACK_API_BASE || localStorage.getItem('profitstack_api_base');
  if (explicit) return explicit.replace(/\/$/, '');

  return window.location.origin;
}
