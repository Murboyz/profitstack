import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

async function loadStatus() {
  const app = document.getElementById('statusCard');
  const res = await apiFetch('/api/crm-connection');
  const data = await res.json();
  const credentialEnvelope = data.encrypted_credentials || {};
  app.innerHTML = `
    <div class="row"><span>Provider</span><strong>${data.provider}</strong></div>
    <div class="row"><span>Status</span><strong>${data.status}</strong></div>
    <div class="row"><span>Auth Type</span><strong>${data.auth_type || data.authType || '—'}</strong></div>
    <div class="row"><span>Account Label</span><strong>${credentialEnvelope.accountLabel || '—'}</strong></div>
    <div class="row"><span>Credential Fields</span><strong>${(credentialEnvelope.fieldKeys || []).join(', ') || 'None saved'}</strong></div>
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
      let credentials;
      try {
        credentials = JSON.parse(document.getElementById('credentialsJson').value || '{}');
      } catch {
        result.textContent = 'Credential JSON is invalid.';
        return;
      }
      const payload = {
        provider: document.getElementById('provider').value,
        authType: document.getElementById('authType').value,
        accountLabel: document.getElementById('accountLabel').value.trim(),
        credentials,
      };
      const res = await apiFetch('/api/crm-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      result.textContent = data.message;
      await loadStatus();
    });
  } catch (error) {
    result.textContent = `Failed to load CRM status: ${error.message}`;
  }
}

main();
