import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function main() {
  const app = document.getElementById('app');
  try {
    await renderSessionBanner();
    const res = await apiFetch('/api/session');
    const data = await res.json();
    app.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    app.textContent = `Failed to load session: ${error.message}`;
  }
}

main();
