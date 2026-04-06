import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function loadSyncRuns() {
  const app = document.getElementById('app');
  const res = await apiFetch('/api/sync-runs');
  const data = await res.json();
  const items = data.items || [];
  if (!items.length) {
    app.textContent = 'No sync runs found.';
    return;
  }
  app.innerHTML = items.map(item => `
    <div class="row">
      <span>${item.startedAt}</span>
      <strong>${item.status}</strong>
      <span>${item.recordsPulled ?? 0} records</span>
      <span>${item.errorMessage || 'No errors'}</span>
    </div>
  `).join('');
}

async function main() {
  const result = document.getElementById('result');
  try {
    await renderSessionBanner();
    await loadSyncRuns();
    document.getElementById('syncForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        status: document.getElementById('status').value,
        recordsPulled: Number(document.getElementById('recordsPulled').value || 0),
        errorMessage: document.getElementById('errorMessage').value.trim() || null,
      };
      const res = await apiFetch('/api/sync-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      result.textContent = data.message;
      document.getElementById('errorMessage').value = '';
      await loadSyncRuns();
    });
  } catch (error) {
    result.textContent = `Failed to load sync runs: ${error.message}`;
    document.getElementById('app').textContent = `Failed to load sync runs: ${error.message}`;
  }
}

main();
