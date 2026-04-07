import { apiFetch, getCurrentUserEmail, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function panel(title, body) {
  return `<div class="panel"><h2>${title}</h2>${body}</div>`;
}

function deltaLabel(current = 0, previous = 0) {
  const delta = current - previous;
  if (delta === 0) return 'Flat vs last week';
  return delta > 0 ? `${money.format(delta)} above last week` : `${money.format(Math.abs(delta))} below last week`;
}

async function loadJson(path) {
  const separator = path.includes('?') ? '&' : '?';
  const res = await apiFetch(`${path}${separator}t=${Date.now()}`);
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json();
}

async function renderDashboard() {
  const status = document.getElementById('status');
  const app = document.getElementById('app');

  try {
    status.textContent = 'Refreshing dashboard…';
    await renderSessionBanner();
    const [session, dashboard, crmConnection, overrides, syncRuns, health] = await Promise.all([
      loadJson('/api/session'),
      loadJson('/api/dashboard'),
      loadJson('/api/crm-connection'),
      loadJson('/api/overrides'),
      loadJson('/api/sync-runs'),
      loadJson('/api/health')
    ]);

    status.textContent = `Loaded ${session.organization.name} · ${session.user.email} · CRM ${crmConnection.provider} · ${crmConnection.status}`;

    const currentApprovedSales = dashboard.weeks.currentWeek.approvedSales || 0;
    const lastApprovedSales = dashboard.weeks.lastWeek.approvedSales || 0;
    const currentScheduled = dashboard.weeks.currentWeek.scheduledProduction || 0;
    const nextThreeScheduled = (dashboard.weeks.nextWeek.scheduledProduction || 0)
      + (dashboard.weeks.weekPlus2.scheduledProduction || 0)
      + (dashboard.weeks.weekPlus3.scheduledProduction || 0);

    app.innerHTML = `
      ${panel('Current Week', `
        <div class="muted">${dashboard.weeks.currentWeek.range}</div>
        <div class="grid">
          <div><div class="muted">Scheduled Production</div><div class="value">${money.format(dashboard.weeks.currentWeek.scheduledProduction)}</div></div>
          <div><div class="muted">Approved Sales</div><div class="value">${money.format(dashboard.weeks.currentWeek.approvedSales || 0)}</div></div>
          <div><div class="muted">Last Sync</div><div class="value">${crmConnection.last_sync_at || crmConnection.lastSyncAt || '—'}</div></div>
        </div>
      `)}
      ${panel('Last Week', `
        <div class="row"><span>Range</span><strong>${dashboard.weeks.lastWeek.range}</strong></div>
        <div class="row"><span>Scheduled Production</span><strong>${money.format(dashboard.weeks.lastWeek.scheduledProduction)}</strong></div>
        <div class="row"><span>Approved Sales</span><strong>${money.format(dashboard.weeks.lastWeek.approvedSales || 0)}</strong></div>
      `)}
      ${panel('Next 3 Weeks', `
        <div class="row"><span>${dashboard.weeks.nextWeek.range}</span><strong>${money.format(dashboard.weeks.nextWeek.scheduledProduction)}</strong></div>
        <div class="row"><span>${dashboard.weeks.weekPlus2.range}</span><strong>${money.format(dashboard.weeks.weekPlus2.scheduledProduction)}</strong></div>
        <div class="row"><span>${dashboard.weeks.weekPlus3.range}</span><strong>${money.format(dashboard.weeks.weekPlus3.scheduledProduction)}</strong></div>
      `)}
      ${panel('Sales Snapshot', `
        <div class="row"><span>This Week Approved Sales</span><strong>${money.format(currentApprovedSales)}</strong></div>
        <div class="row"><span>Last Week Approved Sales</span><strong>${money.format(lastApprovedSales)}</strong></div>
        <div class="row"><span>Week-over-Week</span><strong>${deltaLabel(currentApprovedSales, lastApprovedSales)}</strong></div>
      `)}
      ${panel('Production Outlook', `
        <div class="row"><span>This Week Scheduled</span><strong>${money.format(currentScheduled)}</strong></div>
        <div class="row"><span>Next 3 Weeks Scheduled</span><strong>${money.format(nextThreeScheduled)}</strong></div>
        <div class="row"><span>Next Sync Count</span><strong>${(syncRuns.items || []).length} logged runs</strong></div>
      `)}
      ${panel('Live Status', `
        <div class="row"><span>Supabase</span><strong>${health.supabase ? 'connected' : 'error'}</strong></div>
        <div class="row"><span>User Context</span><strong>${session.user.email || getCurrentUserEmail()}</strong></div>
        <div class="row"><span>Override Rows</span><strong>${(overrides.items || []).length}</strong></div>
        <div class="row"><span>Sync Runs</span><strong>${(syncRuns.items || []).length}</strong></div>
        <div class="row"><span>CRM Connection</span><strong>${crmConnection.status || 'unknown'}</strong></div>
      `)}
    `;
  } catch (error) {
    status.textContent = `Failed to load dashboard: ${error.message}`;
  }
}

document.getElementById('refreshButton').addEventListener('click', renderDashboard);
renderDashboard();
