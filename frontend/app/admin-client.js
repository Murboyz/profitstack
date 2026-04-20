import { apiFetch, requireLogin } from './auth.js';

requireLogin();

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

let lastClientData = null;

async function refreshClientData() {
  const orgId = new URLSearchParams(window.location.search).get('org');
  if (!orgId) {
    document.getElementById('app').innerHTML = '<div class="panel">Missing org id.</div>';
    return;
  }

  try {
    const res = await apiFetch('/api/admin/clients');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Admin load failed with ${res.status}`);

    const client = (data.clients || []).find(item => item.organization?.id === orgId);
    if (!client) throw new Error('Client not found');

    lastClientData = client;

    document.getElementById('title').textContent = client.organization.name;
    document.getElementById('subtitle').textContent = `${client.primaryUser?.email || 'No email'} · ${client.organization.timezone || 'No timezone'} · ${billingLabel(client.billing?.subscriptionStatus)}`;

    document.getElementById('app').innerHTML = `
      <div class="panel">
        <div class="metric-grid">
          <div class="metric"><div class="eyebrow">Sales month</div><strong>${formatMoney(client.metrics?.salesMonth)}</strong></div>
          <div class="metric"><div class="eyebrow">Month production</div><strong>${formatMoney(client.metrics?.monthProduction)}</strong></div>
          <div class="metric"><div class="eyebrow">Expense target</div><strong>${formatMoney(client.metrics?.monthlyExpenseTarget)}</strong></div>
          <div class="metric"><div class="eyebrow">Profit goal</div><strong>${Number(client.metrics?.profitGoalPercent || 0)}%</strong></div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="eyebrow">Account</div>
          <div class="row"><span class="muted">Primary user</span><span>${client.primaryUser?.fullName || '—'}</span></div>
          <div class="row"><span class="muted">Email</span><span>${client.primaryUser?.email || '—'}</span></div>
          <div class="row"><span class="muted">CRM</span><span>${client.crm?.status || 'not connected'}</span></div>
          <div class="row"><span class="muted">Last sync</span><span>${formatDate(client.sync?.finishedAt || client.crm?.lastSyncAt)}</span></div>
          <div class="row"><span class="muted">Billing</span><span>${billingLabel(client.billing?.subscriptionStatus)}</span></div>
        </div>

        <div class="panel">
          <div class="eyebrow">Recent weeks</div>
          ${(client.metrics?.weeks || []).map(week => `
            <div class="row">
              <span>${week.weekStartDate}</span>
              <span>${formatMoney(week.scheduledProduction)} scheduled · ${formatMoney(week.approvedSales)} approved</span>
            </div>
          `).join('') || '<div class="muted">No week metrics yet.</div>'}
        </div>
      </div>
    `;

    // START: Automatic refresh polling
    if (!window.refreshPollInterval) {
      const pollIntervalMs = 60000; // 60 seconds
      const pollFunc = async () => {
        if (document.hidden) return; // Skip if tab is not visible
        try {
          const checkRes = await fetch(`/api/admin/check-refresh?org=${encodeURIComponent(orgId)}`);
          const checkData = await checkRes.json();
          if (checkData.refresh) {
            console.log('Refresh triggered by backend flag');
            await refreshClientData();
          }
        } catch (err) {
          console.error('Error polling refresh flag:', err);
        }
      };
      window.refreshPollInterval = setInterval(pollFunc, pollIntervalMs);
    }
    // END: Automatic refresh polling

  } catch (error) {
    document.getElementById('app').innerHTML = `<div class="panel">Failed to load client view: ${error.message}</div>`;
  }
}

window.refreshClientData = refreshClientData;

// Harden refreshClientData UI update for display glitch
(async () => {
  const originalRefreshClientData = window.refreshClientData;

  window.refreshClientData = async function robustRefreshClientData() {
    await originalRefreshClientData();
    if (lastClientData && lastClientData.metrics) {
      const root = document.getElementById('app');
      const { salesMonth, monthProduction, monthlyExpenseTarget, profitGoalPercent } = lastClientData.metrics;
      if (root) {
        root.querySelectorAll('.metric-grid .metric strong').forEach(el => el.textContent = '');
        const metricElements = root.querySelectorAll('.metric-grid .metric');
        if (metricElements.length >= 4) {
          metricElements[0].querySelector('strong').textContent = formatMoney(salesMonth);
          metricElements[1].querySelector('strong').textContent = formatMoney(monthProduction);
          metricElements[2].querySelector('strong').textContent = formatMoney(monthlyExpenseTarget);
          metricElements[3].querySelector('strong').textContent = `${Number(profitGoalPercent || 0)}%`;
        }
      }
      console.group('Client metrics Log (robust)');
      console.log('salesMonth:', salesMonth);
      console.log('monthProduction:', monthProduction);
      console.log('monthlyExpenseTarget:', monthlyExpenseTarget);
      console.groupEnd();
    }
  };
})();





async function main() {
  const orgId = new URLSearchParams(window.location.search).get('org');
  const app = document.getElementById('app');
  if (!orgId) {
    app.innerHTML = '<div class="panel">Missing org id.</div>';
    return;
  }

  try {
    const res = await apiFetch('/api/admin/clients');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Admin load failed with ${res.status}`);

    const client = (data.clients || []).find((item) => item.organization?.id === orgId);
    if (!client) throw new Error('Client not found');

    document.getElementById('title').textContent = client.organization.name;
    document.getElementById('subtitle').textContent = `${client.primaryUser?.email || 'No email'} · ${client.organization.timezone || 'No timezone'} · ${client.billing?.subscriptionStatus || 'unknown billing'}`;

    app.innerHTML = `
      <div class="panel">
        <div class="metric-grid">
          <div class="metric"><div class="eyebrow">Sales month</div><strong>${formatMoney(client.metrics?.salesMonth)}</strong></div>
          <div class="metric"><div class="eyebrow">Month production</div><strong>${formatMoney(client.metrics?.monthProduction)}</strong></div>
          <div class="metric"><div class="eyebrow">Expense target</div><strong>${formatMoney(client.metrics?.monthlyExpenseTarget)}</strong></div>
          <div class="metric"><div class="eyebrow">Profit goal</div><strong>${Number(client.metrics?.profitGoalPercent || 0)}%</strong></div>
        </div>
      </div>

      <div class="grid">
        <div class="panel">
          <div class="eyebrow">Account</div>
          <div class="row"><span class="muted">Primary user</span><span>${client.primaryUser?.fullName || '—'}</span></div>
          <div class="row"><span class="muted">Email</span><span>${client.primaryUser?.email || '—'}</span></div>
          <div class="row"><span class="muted">CRM</span><span>${client.crm?.status || 'not connected'}</span></div>
          <div class="row"><span class="muted">Last sync</span><span>${formatDate(client.sync?.finishedAt || client.crm?.lastSyncAt)}</span></div>
          <div class="row"><span class="muted">Billing</span><span>${client.billing?.subscriptionStatus || 'unknown'}</span></div>
        </div>

        <div class="panel">
          <div class="eyebrow">Recent weeks</div>
          ${(client.metrics?.weeks || []).map((week) => `
            <div class="row">
              <span>${week.weekStartDate}</span>
              <span>${formatMoney(week.scheduledProduction)} scheduled · ${formatMoney(week.approvedSales)} approved</span>
            </div>
          `).join('') || '<div class="muted">No week metrics yet.</div>'}
        </div>
      </div>
    `;
  } catch (error) {
    app.innerHTML = `<div class="panel">Failed to load client view: ${error.message}</div>`;
  }
}

main();
