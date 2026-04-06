import { apiFetch, getCurrentUserEmail, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function panel(title, body) {
  return `<div class="panel"><h2>${title}</h2>${body}</div>`;
}

async function loadJson(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json();
}

async function main() {
  const status = document.getElementById('status');
  const app = document.getElementById('app');

  try {
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

main();
