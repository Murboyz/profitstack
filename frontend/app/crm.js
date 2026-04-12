import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function loadStatus() {
  const app = document.getElementById('statusCard');
  const res = await apiFetch('/api/crm-connection');
  const data = await res.json();
  const credentialEnvelope = data.encrypted_credentials || {};
  app.innerHTML = `
    <div class="row"><span>Provider</span><strong>${data.provider || '—'}</strong></div>
    <div class="row"><span>Status</span><strong>${data.status || 'not connected'}</strong></div>
    <div class="row"><span>Account Label</span><strong>${credentialEnvelope.accountLabel || '—'}</strong></div>
    <div class="row"><span>Saved Fields</span><strong>${(credentialEnvelope.fieldKeys || []).join(', ') || 'None saved'}</strong></div>
    <div class="row"><span>Saved At</span><strong>${credentialEnvelope.savedAt || '—'}</strong></div>
    <div class="row"><span>Last Sync</span><strong>${data.last_sync_at || data.lastSyncAt || '—'}</strong></div>
    <div class="row"><span>Last Error</span><strong>${data.last_error || data.lastError || 'None'}</strong></div>
  `;
}

async function main() {
  const result = document.getElementById('result');
  try {
    await renderSessionBanner();
    await loadStatus();
    document.getElementById('crmForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        provider: document.getElementById('provider').value,
        authType: 'session_or_oauth',
        accountLabel: document.getElementById('accountLabel').value.trim(),
        credentials: {
          sessionCookie: document.getElementById('sessionCookie').value.trim(),
          locationId: document.getElementById('locationId').value.trim() || undefined,
        },
      };
      if (!payload.credentials.sessionCookie) {
        result.innerHTML = '<p class="error">Session cookie is required.</p>';
        return;
      }
      const res = await apiFetch('/api/crm-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        result.innerHTML = `<p class="error">${data.error || 'Failed to save CRM connection.'}</p>`;
        return;
      }
      result.innerHTML = `<p class="success">${data.message}</p><p><a href="./dashboard.html">Go back to the dashboard</a> and click <strong>Refresh Data</strong>.</p>`;
      await loadStatus();
    });
  } catch (error) {
    result.innerHTML = `<p class="error">Failed to load CRM status: ${error.message}</p>`;
  }
}

main();
