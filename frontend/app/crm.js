import { apiFetch, requireLogin, getAccessToken } from './auth.js';
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

function statusBadgeClass(status, hasError) {
  if (status === 'connected' && hasError) return 'status-warning';
  if (status === 'connected') return 'status-connected';
  if (status === 'pending') return 'status-pending';
  return 'status-missing';
}

async function loadStatus() {
  const app = document.getElementById('statusCard');
  const res = await apiFetch('/api/crm-connection');
  const data = await res.json();
  const status = data.status || 'not_connected';
  const hasError = Boolean(data.lastError);
  const isJobber = data.provider === 'jobber';
  const providerLabel = isJobber ? 'Jobber' : data.provider === 'housecall_pro' ? 'Housecall Pro' : 'CRM';
  const statusLabel = (status === 'connected' && hasError) ? 'connected (with errors)' : status.replaceAll('_', ' ');
  const statusDesc = status === 'connected' && hasError
    ? `Your ${providerLabel} account is connected but the last sync encountered an error. Try Refresh Data on the dashboard.`
    : status === 'connected'
      ? `Your ${providerLabel} account is connected for this organization.`
      : status === 'disconnected'
        ? `${providerLabel} is disconnected. Your last synced numbers remain on the dashboard until you refresh with a new connection.`
        : 'No CRM is connected yet.';
  app.innerHTML = `
    <div>
      <div class="status-badge ${statusBadgeClass(status, hasError)}">${escapeHtml(statusLabel)}</div>
    </div>
    <div>
      <h3>${escapeHtml(providerLabel)}</h3>
      <p>${statusDesc}</p>
    </div>
    <div class="row"><span>Connection Name</span><strong>${escapeHtml(data.accountLabel || '—')}</strong></div>
    <div class="row"><span>Auth Type</span><strong>${escapeHtml(data.authType || '—')}</strong></div>
    <div class="row"><span>Saved Fields</span><strong>${escapeHtml((data.savedFields || []).join(', ') || 'None saved')}</strong></div>
    <div class="row"><span>Saved At</span><strong>${escapeHtml(data.savedAt || '—')}</strong></div>
    <div class="row"><span>Last Sync</span><strong>${escapeHtml(data.lastSyncAt || '—')}</strong></div>
    <div class="row"><span>Last Error</span><strong>${escapeHtml(data.lastError || 'None')}</strong></div>
    ${status === 'connected' ? `<div class="actions"><button type="button" id="disconnectButton">Disconnect ${escapeHtml(providerLabel)}</button></div>` : ''}
  `;

  const disconnectButton = document.getElementById('disconnectButton');
  if (disconnectButton) {
    disconnectButton.addEventListener('click', async () => {
      const confirmed = window.confirm(`Disconnect ${providerLabel}? Your last synced numbers will stay on the dashboard, but future refreshes will require a reconnect.`);
      if (!confirmed) return;
      disconnectButton.disabled = true;
      disconnectButton.textContent = 'Disconnecting…';
      const result = document.getElementById('result');
      result.innerHTML = `<p class="muted">Disconnecting ${escapeHtml(providerLabel)} without touching saved numbers…</p>`;
      try {
        const res = await apiFetch('/api/crm-connection/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const payload = await res.json();
        if (!res.ok) {
          result.innerHTML = `<p class="error">${escapeHtml(payload.error || `Failed to disconnect ${providerLabel}.`)}</p>`;
          disconnectButton.disabled = false;
          disconnectButton.textContent = `Disconnect ${escapeHtml(providerLabel)}`;
          return;
        }
        result.innerHTML = `<p class="success">${escapeHtml(payload.message || `${providerLabel} disconnected.`)}</p>`;
        await loadStatus();
      } catch (error) {
        result.innerHTML = `<p class="error">${escapeHtml(error.message || `Failed to disconnect ${providerLabel}.`)}</p>`;
        disconnectButton.disabled = false;
        disconnectButton.textContent = `Disconnect ${escapeHtml(providerLabel)}`;
      }
    });
  }

  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.textContent = 'Save Housecall Pro Connection';
  }

  const jobberPanel = document.getElementById('jobberPanel');
  const hcpPanel = document.getElementById('hcpPanel');
  const jobberEyebrow = document.getElementById('jobberEyebrow');
  const hcpEyebrow = document.querySelector('#hcpPanel .eyebrow');

  if (jobberPanel) jobberPanel.classList.remove('active-provider', 'inactive-provider');
  if (hcpPanel) hcpPanel.classList.remove('active-provider', 'inactive-provider');
  if (jobberEyebrow) jobberEyebrow.classList.remove('eyebrow-active');
  if (hcpEyebrow) hcpEyebrow.classList.remove('eyebrow-active');

  if (status === 'connected' && isJobber) {
    if (jobberPanel) jobberPanel.classList.add('active-provider');
    if (hcpPanel) hcpPanel.classList.add('inactive-provider');
    if (jobberEyebrow) jobberEyebrow.classList.add('eyebrow-active');
  } else if (status === 'connected' && !isJobber) {
    if (hcpPanel) hcpPanel.classList.add('active-provider');
    if (jobberPanel) jobberPanel.classList.add('inactive-provider');
    if (hcpEyebrow) hcpEyebrow.classList.add('eyebrow-active');
  }

  return data;
}

function renderOnboardingMessage() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('onboarding');
  const next = params.get('next');
  const result = document.getElementById('result');
  if (mode === 'connect-crm' && result) {
    result.innerHTML = `<p class="muted">Next step: connect Housecall Pro here, then you will go straight to ${next === 'dashboard-setup' ? 'the final setup step for expenses, profit goal, and timezone.' : 'the dashboard.'}</p>`;
  }

  const jobberResult = document.getElementById('jobberResult');
  const jobberStatus = params.get('jobber');
  if (jobberStatus === 'connected' && jobberResult) {
    jobberResult.innerHTML = '<p class="success">Jobber connected successfully. Go to the dashboard and click Refresh Data.</p>';
  } else if (jobberStatus === 'error' && jobberResult) {
    const reason = params.get('reason') || 'unknown';
    jobberResult.innerHTML = `<p class="error">Jobber connection failed: ${escapeHtml(reason)}. Please try again.</p>`;
  }
}

async function main() {
  const result = document.getElementById('result');
  const form = document.getElementById('crmForm');

  try {
    await renderSessionBanner();
    renderOnboardingMessage();
    await loadStatus();

    const jobberBtn = document.getElementById('jobberConnectBtn');
    if (jobberBtn) {
      jobberBtn.addEventListener('click', () => {
        const token = getAccessToken();
        window.location.href = `/api/jobber/authorize?token=${encodeURIComponent(token)}`;
      });
    }

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

        const params = new URLSearchParams(window.location.search);
        const next = params.get('next');
        const nextHref = next === 'dashboard-setup' ? './connect-crm.html?next=dashboard-setup&crm=connected' : './connect-crm.html?crm=connected';
        result.innerHTML = `<p class="success">${escapeHtml(data.message || 'Housecall Pro connection saved.')}</p><p class="muted" style="margin-top: 8px;">Sending you back to the setup checklist so you can confirm everything is complete.</p>`;
        document.getElementById('sessionCookie').value = '';
        await loadStatus();
        window.setTimeout(() => {
          window.location.href = nextHref;
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
