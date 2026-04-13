import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function statusBadgeClass(status) {
  if (status === 'connected') return 'status-connected';
  if (status === 'pending') return 'status-pending';
  return 'status-missing';
}

async function loadStatus() {
  const app = document.getElementById('statusCard');
  const res = await apiFetch('/api/crm-connection');
  const data = await res.json();
  const status = data.status || 'not_connected';
  const statusLabel = status.replaceAll('_', ' ');
  app.innerHTML = `
    <div>
      <div class="status-badge ${statusBadgeClass(status)}">${escapeHtml(statusLabel)}</div>
    </div>
    <div>
      <h3>${escapeHtml(data.provider === 'housecall_pro' ? 'Housecall Pro' : 'CRM Connection')}</h3>
      <p>${status === 'connected' ? 'Your active Housecall Pro session is saved for this organization.' : 'No active Housecall Pro session is saved yet.'}</p>
    </div>
    <div class="row"><span>Connection Name</span><strong>${escapeHtml(data.accountLabel || '—')}</strong></div>
    <div class="row"><span>Auth Type</span><strong>${escapeHtml(data.authType || '—')}</strong></div>
    <div class="row"><span>Saved Fields</span><strong>${escapeHtml((data.savedFields || []).join(', ') || 'None saved')}</strong></div>
    <div class="row"><span>Saved At</span><strong>${escapeHtml(data.savedAt || '—')}</strong></div>
    <div class="row"><span>Last Sync</span><strong>${escapeHtml(data.lastSyncAt || '—')}</strong></div>
    <div class="row"><span>Last Error</span><strong>${escapeHtml(data.lastError || 'None')}</strong></div>
  `;

  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.textContent = status === 'connected' ? 'Update Housecall Pro Connection' : 'Save Housecall Pro Connection';
  }

  return data;
}

function renderOnboardingMessage() {
  const mode = new URLSearchParams(window.location.search).get('onboarding');
  const result = document.getElementById('result');
  if (mode === 'connect-crm' && result) {
    result.innerHTML = '<p class="muted">Next step: connect Housecall Pro here, then you will go straight to the dashboard.</p>';
  }
}

async function main() {
  const result = document.getElementById('result');
  const form = document.getElementById('crmForm');

  try {
     await renderSessionBanner();
+    renderOnboardingMessage();
     await loadStatus();
    await renderSessionBanner();
    await loadStatus();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const saveButton = document.getElementById('saveButton');
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
        result.innerHTML = '<p class="error">Paste the active Housecall Pro session cookie before saving.</p>';
        return;
      }

      try {
        if (saveButton) {
          saveButton.disabled = true;
          saveButton.textContent = 'Saving…';
        }
        result.innerHTML = '<p class="muted">Saving Housecall Pro connection…</p>';

        const res = await apiFetch('/api/crm-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          result.innerHTML = `<p class="error">${escapeHtml(data.error || 'Failed to save CRM connection.')}</p>`;
          return;
        }

        result.innerHTML = `<p class="success">${escapeHtml(data.message || 'Housecall Pro connection saved.')}</p><p class="muted" style="margin-top: 8px;">Sending you to the dashboard now so you can click <strong>Refresh Data</strong>.</p>`;
        document.getElementById('sessionCookie').value = '';
        await loadStatus();
        window.setTimeout(() => {
          window.location.href = './dashboard.html?crm=connected';
        }, 1200);
      } catch (error) {
        result.innerHTML = `<p class="error">${escapeHtml(error.message || 'Failed to save CRM connection.')}</p>`;
      } finally {
        if (saveButton) {
          saveButton.disabled = false;
        }
      }
    });
  } catch (error) {
    result.innerHTML = `<p class="error">Failed to load CRM status: ${escapeHtml(error.message)}</p>`;
  }
}

main();
