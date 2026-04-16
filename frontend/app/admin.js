import { apiFetch, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';

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

function pillClass(value) {
  const raw = String(value || '').toLowerCase();
  if (['active', 'success', 'connected'].includes(raw)) return 'pill success';
  if (['past_due', 'unpaid', 'canceled', 'cancelled', 'failed', 'disconnected'].includes(raw)) return 'pill danger';
  return 'pill warn';
}

async function main() {
  const summary = document.getElementById('summary');
  const clientsEl = document.getElementById('clients');

  try {
    await renderSessionBanner();
    const res = await apiFetch('/api/admin/clients');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Admin load failed with ${res.status}`);

    const clients = data.clients || [];
    const activeBilling = clients.filter((client) => String(client.billing?.subscriptionStatus || '').toLowerCase() === 'active').length;
    const connectedCrm = clients.filter((client) => String(client.crm?.status || '').toLowerCase() === 'connected').length;

    summary.innerHTML = `
      <div class="panel">
        <div class="eyebrow">Clients</div>
        <div style="font-size:34px;font-weight:800;">${clients.length}</div>
        <div class="muted">Generated ${formatDate(data.generatedAt)}</div>
      </div>
      <div class="panel">
        <div class="eyebrow">Live status</div>
        <div class="row"><span>Billing active</span><strong>${activeBilling}</strong></div>
        <div class="row"><span>CRM connected</span><strong>${connectedCrm}</strong></div>
      </div>
    `;

    clientsEl.innerHTML = clients.map((client) => `
      <div class="panel">
        <div class="eyebrow">${client.organization.slug || 'client'}</div>
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <h2 style="margin:0 0 6px;">${client.organization.name}</h2>
            <div class="muted">${client.primaryUser?.fullName || 'No user'} · ${client.primaryUser?.email || 'No email'}</div>
          </div>
          <span class="${pillClass(client.organization.status)}">${client.organization.status || 'unknown'}</span>
        </div>

        <div class="metric-grid">
          <div class="metric"><div class="eyebrow">Sales month</div><strong>${formatMoney(client.metrics?.salesMonth)}</strong></div>
          <div class="metric"><div class="eyebrow">Month production</div><strong>${formatMoney(client.metrics?.monthProduction)}</strong></div>
          <div class="metric"><div class="eyebrow">Expense target</div><strong>${formatMoney(client.metrics?.monthlyExpenseTarget)}</strong></div>
          <div class="metric"><div class="eyebrow">Profit goal</div><strong>${Number(client.metrics?.profitGoalPercent || 0)}%</strong></div>
        </div>

        <div style="margin-top:14px;">
          <div class="row"><span class="muted">Timezone</span><span>${client.organization.timezone || '—'}</span></div>
          <div class="row"><span class="muted">CRM</span><span><span class="${pillClass(client.crm?.status)}">${client.crm?.status || 'not connected'}</span></span></div>
          <div class="row"><span class="muted">Last sync</span><span>${formatDate(client.sync?.finishedAt || client.crm?.lastSyncAt)}</span></div>
          <div class="row"><span class="muted">Billing</span><span><span class="${pillClass(client.billing?.subscriptionStatus)}">${client.billing?.subscriptionStatus || 'unknown'}</span></span></div>
          <div class="row"><span class="muted">Billing renewal</span><span>${formatDate(client.billing?.currentPeriodEnd)}</span></div>
          <div class="row"><span class="muted">Latest week</span><span>${client.metrics?.latestWeekStart || '—'} · ${formatMoney(client.metrics?.latestWeekScheduled)}</span></div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    summary.innerHTML = `<div class="panel">Failed to load admin panel: ${error.message}</div>`;
    clientsEl.innerHTML = '';
  }
}

main();
