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

function parseNumber(value) {
  return Number(String(value ?? '').replace(/[^0-9.]/g, '')) || 0;
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

function collectTargetInputs() {
  const savedTargets = readTargets();
  return {
    ...savedTargets,
    monthlyExpenseTarget: document.getElementById('monthlyExpenseTarget')?.value ?? savedTargets.monthlyExpenseTarget,
    profitPercentGoal: document.getElementById('profitPercentGoal')?.value ?? savedTargets.profitPercentGoal,
  };
}

function bindTargetInputs() {
  const save = () => {
    writeTargets(collectTargetInputs());
    renderDashboard();
  };

  document.getElementById('saveTargetsButton').addEventListener('click', save);
  ['monthlyExpenseTarget', 'profitPercentGoal']
    .forEach((id) => document.getElementById(id).addEventListener('change', save));
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
    const monthlyExpenseTarget = parseNumber(savedTargets.monthlyExpenseTarget || 0);
    const profitPercentGoal = parseNumber(savedTargets.profitPercentGoal || 0);
    const opportunityCount = parseNumber(savedTargets.opportunityCount || 0);
    const salesToday = parseNumber(savedTargets.salesToday || 0);
    const salesMonth = parseNumber(savedTargets.salesMonth || 0);
    const salesYear = parseNumber(savedTargets.salesYear || 0);
    const targetMetrics = computeTargets(monthlyExpenseTarget, profitPercentGoal, currentScheduled);
    const companySpo = computeCompanySpo(currentApprovedSales, opportunityCount);

    app.innerHTML = `
      <div class="layout">
        <section class="panel">
          <h2>Onboarding Flow</h2>
          <div class="clientbar"><strong>Current mode:</strong> prototype-style dashboard shell with live data where trusted and manual inputs where you still want control.</div>
          <div class="stepbar">
            <div class="step active"><strong>1. Set operating target</strong><span>manual</span></div>
            <div class="step active"><strong>2. Review live CRM numbers</strong><span>live</span></div>
            <div class="step active"><strong>3. Refresh + coach</strong><span>live/manual</span></div>
          </div>

          <div class="field">
            <label for="monthlyExpenseTarget">Monthly Expense Target</label>
            <input id="monthlyExpenseTarget" value="${monthlyExpenseTarget || ''}" placeholder="35000" />
          </div>
          <div class="field">
            <label for="profitPercentGoal">Profit % Goal</label>
            <input id="profitPercentGoal" value="${profitPercentGoal || ''}" placeholder="20" />
          </div>
          <div class="actions">
            <button id="saveTargetsButton" class="btn-primary" type="button">Save + Recalculate</button>
            <button id="refreshButton" type="button">Refresh Data</button>
          </div>

          <div class="card">
            <h3>Data Trust</h3>
            <p>Live data is used for scheduled production, approved sales, CRM status, sync history, and overrides. Manual inputs are only the target + rollup fields you control.</p>
            <div class="row"><span class="label">CRM</span><strong>${crmConnection.status || 'unknown'}</strong></div>
            <div class="row"><span class="label">Sync Runs</span><strong>${(syncRuns.items || []).length}</strong></div>
            <div class="row"><span class="label">Overrides</span><strong>${(overrides.items || []).length}</strong></div>
            <div class="tag live">Live + manual</div>
          </div>
        </section>

        <section>
          <div class="stats">
            <div class="stat blue">
              <div class="k">Weekly Break-Even</div>
              <div class="v">${money.format(targetMetrics.weeklyBreakEven)}</div>
              <div class="note">Monthly expense target ÷ 4</div>
            </div>
            <div class="stat green">
              <div class="k">Weekly Goal</div>
              <div class="v">${money.format(targetMetrics.weeklyGoal)}</div>
              <div class="note">Break-even + profit goal</div>
            </div>
            <div class="stat yellow">
              <div class="k">Company SPO</div>
              <div class="v">${money.format(companySpo)}</div>
              <div class="note">Approved sales ÷ opportunities</div>
            </div>
          </div>

          <div class="scoreline ${currentScheduled >= targetMetrics.weeklyGoal ? 'good' : 'bad'}">
            <div>
              <div class="small">Scheduled production vs weekly goal</div>
              <div class="big">${targetMetrics.paceLabel}</div>
            </div>
            <div class="small">Current week · ${dashboard.weeks.currentWeek.range}</div>
          </div>

          <div class="two">
            ${panel('Current Week', `
              <div class="row"><span class="label">Range</span><strong>${dashboard.weeks.currentWeek.range}</strong></div>
              <div class="row"><span class="label">Scheduled Production</span><strong>${money.format(currentScheduled)}</strong></div>
              <div class="row"><span class="label">Approved Sales</span><strong>${money.format(currentApprovedSales)}</strong></div>
              <div class="row"><span class="label">Last Sync</span><strong>${crmConnection.last_sync_at || crmConnection.lastSyncAt || '—'}</strong></div>
              <div class="tag live">Live</div>
            `)}
            ${panel('Sales Rollup', `
              <div class="row"><span class="label">Sales Today</span><strong>${money.format(salesToday)}</strong></div>
              <div class="row"><span class="label">Sales This Week</span><strong>${money.format(currentApprovedSales)}</strong></div>
              <div class="row"><span class="label">Sales This Month</span><strong>${money.format(salesMonth)}</strong></div>
              <div class="row"><span class="label">Sales This Year</span><strong>${money.format(salesYear)}</strong></div>
              <div class="tag manual">Manual + live</div>
            `)}
            ${panel('Last Week Snapshot', `
              <div class="row"><span class="label">Range</span><strong>${dashboard.weeks.lastWeek.range}</strong></div>
              <div class="row"><span class="label">Approved Sales</span><strong>${money.format(lastApprovedSales)}</strong></div>
              <div class="row"><span class="label">Scheduled Production</span><strong>${money.format(dashboard.weeks.lastWeek.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">Week-over-Week</span><strong>${deltaLabel(currentApprovedSales, lastApprovedSales)}</strong></div>
              <div class="tag live">Live</div>
            `)}
            ${panel('Production Outlook', `
              <div class="row"><span class="label">${dashboard.weeks.nextWeek.range}</span><strong>${money.format(dashboard.weeks.nextWeek.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">${dashboard.weeks.weekPlus2.range}</span><strong>${money.format(dashboard.weeks.weekPlus2.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">${dashboard.weeks.weekPlus3.range}</span><strong>${money.format(dashboard.weeks.weekPlus3.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">Next 3 Weeks Total</span><strong>${money.format(nextThreeScheduled)}</strong></div>
              <div class="tag live">Live</div>
            `)}
          </div>
        </section>
      </div>
    `;

    bindTargetInputs();
    document.getElementById('refreshButton').addEventListener('click', renderDashboard);
  } catch (error) {
    status.textContent = `Failed to load dashboard: ${error.message}`;
  }
}

renderDashboard();
