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
