import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function loadOverrides() {
  const app = document.getElementById('list');
  const res = await apiFetch('/api/overrides');
  const data = await res.json();
  const items = data.items || [];
  app.innerHTML = items.map(item => `
    <div class="row">
      <span>${item.weekStartDate}</span>
      <strong>${item.metricKey}</strong>
      <strong>${item.metricValue}</strong>
    </div>
  `).join('') || 'No overrides found.';
}

async function main() {
  const result = document.getElementById('result');
  try {
    await renderSessionBanner();
    await loadOverrides();
    document.getElementById('overrideForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        weekStartDate: document.getElementById('weekStartDate').value,
        metricKey: document.getElementById('metricKey').value,
        metricValue: Number(document.getElementById('metricValue').value),
        reason: document.getElementById('reason').value
      };
      const res = await apiFetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      result.textContent = data.message;
      await loadOverrides();
    });
  } catch (error) {
    result.textContent = `Failed to load overrides: ${error.message}`;
  }
}

main();
