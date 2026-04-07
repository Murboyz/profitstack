import { apiFetch, getCurrentUserEmail, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TARGETS_STORAGE_KEY = 'profitstack_dashboard_targets';

function panel(title, body) {
  return `<div class="panel"><h2>${title}</h2>${body}</div>`;
}

function deltaLabel(current = 0, previous = 0) {
  const delta = current - previous;
  if (delta === 0) return 'Flat vs last week';
  return delta > 0 ? `${money.format(delta)} above last week` : `${money.format(Math.abs(delta))} below last week`;
}

function readTargets() {
  try {
    return JSON.parse(localStorage.getItem(TARGETS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeTargets(targets) {
  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets));
}

function computeTargets(monthlyExpenseTarget = 0, profitPercentGoal = 0, scheduledProduction = 0) {
  const weeklyBreakEven = monthlyExpenseTarget / 4;
  const weeklyGoal = weeklyBreakEven * (1 + profitPercentGoal / 100);
  const delta = scheduledProduction - weeklyGoal;
  return {
    weeklyBreakEven,
    weeklyGoal,
    paceLabel: delta >= 0 ? `${money.format(delta)} above goal` : `${money.format(Math.abs(delta))} below goal`,
  };
}

function computeCompanySpo(approvedSales = 0, opportunityCount = 0) {
  if (!opportunityCount) return 0;
  return approvedSales / opportunityCount;
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
    const savedTargets = readTargets();
    const monthlyExpenseTarget = Number(savedTargets.monthlyExpenseTarget || 0);
    const profitPercentGoal = Number(savedTargets.profitPercentGoal || 0);
    const opportunityCount = Number(savedTargets.opportunityCount || 0);
    const salesToday = Number(savedTargets.salesToday || 0);
    const salesMonth = Number(savedTargets.salesMonth || 0);
    const salesYear = Number(savedTargets.salesYear || 0);
    const targetMetrics = computeTargets(monthlyExpenseTarget, profitPercentGoal, currentScheduled);
    const companySpo = computeCompanySpo(currentApprovedSales, opportunityCount);

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
      ${panel('Targets', `
        <div class="input-grid">
          <div>
            <label for="monthlyExpenseTarget">Monthly Expense Target</label>
            <input id="monthlyExpenseTarget" value="${monthlyExpenseTarget || ''}" placeholder="35000" />
          </div>
          <div>
            <label for="profitPercentGoal">Profit % Goal</label>
            <input id="profitPercentGoal" value="${profitPercentGoal || ''}" placeholder="20" />
          </div>
          <div>
            <label for="opportunityCount">Opportunity Count This Week</label>
            <input id="opportunityCount" value="${opportunityCount || ''}" placeholder="12" />
          </div>
          <div>
            <label for="salesToday">Sales Today</label>
            <input id="salesToday" value="${salesToday || ''}" placeholder="0" />
          </div>
          <div>
            <label for="salesMonth">Sales This Month</label>
            <input id="salesMonth" value="${salesMonth || ''}" placeholder="0" />
          </div>
          <div>
            <label for="salesYear">Sales This Year</label>
            <input id="salesYear" value="${salesYear || ''}" placeholder="0" />
          </div>
        </div>
        <div class="actions"><button id="saveTargetsButton" type="button">Save Targets</button></div>
        <div class="row"><span>Weekly Break-Even</span><strong>${money.format(targetMetrics.weeklyBreakEven)}</strong></div>
        <div class="row"><span>Weekly Goal</span><strong>${money.format(targetMetrics.weeklyGoal)}</strong></div>
        <div class="row"><span>Pace vs Goal</span><strong>${targetMetrics.paceLabel}</strong></div>
        <div class="row"><span>Company SPO</span><strong>${money.format(companySpo)}</strong></div>
        <div class="row"><span>Sales Today</span><strong>${money.format(salesToday)}</strong></div>
        <div class="row"><span>Sales This Month</span><strong>${money.format(salesMonth)}</strong></div>
        <div class="row"><span>Sales This Year</span><strong>${money.format(salesYear)}</strong></div>
      `)}
      ${panel('Live Status', `
        <div class="row"><span>Supabase</span><strong>${health.supabase ? 'connected' : 'error'}</strong></div>
        <div class="row"><span>User Context</span><strong>${session.user.email || getCurrentUserEmail()}</strong></div>
        <div class="row"><span>Override Rows</span><strong>${(overrides.items || []).length}</strong></div>
        <div class="row"><span>Sync Runs</span><strong>${(syncRuns.items || []).length}</strong></div>
        <div class="row"><span>CRM Connection</span><strong>${crmConnection.status || 'unknown'}</strong></div>
      `)}
    `;

    document.getElementById('saveTargetsButton').addEventListener('click', () => {
      writeTargets({
        monthlyExpenseTarget: document.getElementById('monthlyExpenseTarget').value,
        profitPercentGoal: document.getElementById('profitPercentGoal').value,
        opportunityCount: document.getElementById('opportunityCount').value,
        salesToday: document.getElementById('salesToday').value,
        salesMonth: document.getElementById('salesMonth').value,
        salesYear: document.getElementById('salesYear').value,
      });
      renderDashboard();
    });
  } catch (error) {
    status.textContent = `Failed to load dashboard: ${error.message}`;
  }
}

document.getElementById('refreshButton').addEventListener('click', renderDashboard);
renderDashboard();
