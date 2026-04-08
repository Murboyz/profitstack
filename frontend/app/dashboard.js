import { apiFetch, getCurrentUserEmail, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TARGETS_STORAGE_KEY = 'profitstack_dashboard_targets';
const ACTIVE_WEEK_STORAGE_KEY = 'profitstack_dashboard_active_week';
const AUTO_SYNC_STORAGE_KEY = 'profitstack_dashboard_auto_sync_done';
const TIMEZONE_STORAGE_KEY = 'profitstack_dashboard_timezone';

function panel(title, body) {
  return `<div class="panel"><h2>${title}</h2>${body}</div>`;
}

function deltaLabel(current = 0, previous = 0) {
  const delta = current - previous;
  if (delta === 0) return 'Flat vs last week';
  return delta > 0 ? `${money.format(delta)} above last week` : `${money.format(Math.abs(delta))} below last week`;
}

function readTargets() {
  const defaults = { profitPercentGoal: 10 };
  try {
    const parsed = JSON.parse(localStorage.getItem(TARGETS_STORAGE_KEY) || '{}');
    const profitPercentGoal = Number(parsed?.profitPercentGoal || 0) === 0
      ? 10
      : parsed.profitPercentGoal;
    return { ...defaults, ...parsed, profitPercentGoal };
  } catch {
    return defaults;
  }
}

function writeTargets(targets) {
  localStorage.setItem(TARGETS_STORAGE_KEY, JSON.stringify(targets));
}

function readActiveWeek() {
  return localStorage.getItem(ACTIVE_WEEK_STORAGE_KEY) || 'currentWeek';
}

function writeActiveWeek(value) {
  localStorage.setItem(ACTIVE_WEEK_STORAGE_KEY, value);
}

function readTimezone(defaultTimezone = 'America/Chicago') {
  return localStorage.getItem(TIMEZONE_STORAGE_KEY) || defaultTimezone;
}

function writeTimezone(value) {
  localStorage.setItem(TIMEZONE_STORAGE_KEY, value);
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

function formatDateTime(value, timeZone = 'America/Chicago') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(date);
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

async function executeLiveSync() {
  const res = await apiFetch('/api/sync-runs/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceLabel: 'dashboard refresh' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Live sync failed with ${res.status}`);
  return data;
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
    const latestSyncRun = (syncRuns.items || [])[0] || null;
    const organizationTimezone = session.organization.timezone || 'America/Chicago';
    const timezone = readTimezone(organizationTimezone);
    const nextThreeScheduled = (dashboard.weeks.nextWeek.scheduledProduction || 0)
      + (dashboard.weeks.weekPlus2.scheduledProduction || 0)
      + (dashboard.weeks.weekPlus3.scheduledProduction || 0);
    const activeWeekKey = ['lastWeek', 'currentWeek', 'nextWeek'].includes(readActiveWeek()) ? readActiveWeek() : 'currentWeek';
    const activeWeek = dashboard.weeks[activeWeekKey] || dashboard.weeks.currentWeek;
    const activeWeekApprovedSales = activeWeek.approvedSales || 0;
    const activeWeekScheduled = activeWeek.scheduledProduction || 0;
    const savedTargets = readTargets();
    const monthlyExpenseTarget = parseNumber(savedTargets.monthlyExpenseTarget || 0);
    const profitPercentGoal = parseNumber(savedTargets.profitPercentGoal || 0);
    const opportunityCount = parseNumber(savedTargets.opportunityCount || 0);
    const salesToday = parseNumber(savedTargets.salesToday || 0);
    const salesMonth = parseNumber(savedTargets.salesMonth || 0);
    const salesYear = parseNumber(savedTargets.salesYear || 0);
    const targetMetrics = computeTargets(monthlyExpenseTarget, profitPercentGoal, activeWeekScheduled);
    const companySpo = computeCompanySpo(activeWeekApprovedSales, opportunityCount);
    const lastWeekGoalDelta = (dashboard.weeks.lastWeek.scheduledProduction || 0) - targetMetrics.weeklyGoal;
    const lastWeekGoalLabel = lastWeekGoalDelta >= 0
      ? `${money.format(lastWeekGoalDelta)} over goal`
      : `${money.format(Math.abs(lastWeekGoalDelta))} below goal`;

    app.innerHTML = `
      <div class="layout">
        <section class="panel">
          <h2>Onboarding Flow</h2>
          <div class="clientbar"><strong>Mode:</strong> set the target, refresh the live data, coach from the numbers.</div>

          <div class="field">
            <label for="monthlyExpenseTarget">Monthly Expense Target</label>
            <input id="monthlyExpenseTarget" value="${monthlyExpenseTarget || ''}" placeholder="35000" />
          </div>
          <div class="field">
            <label for="profitPercentGoal">Profit % Goal</label>
            <input id="profitPercentGoal" value="${profitPercentGoal || ''}" placeholder="10" />
          </div>
          <div class="field">
            <label for="timezoneSelect">Dashboard Timezone</label>
            <select id="timezoneSelect">
              ${[
                'America/Los_Angeles',
                'America/Denver',
                'America/Chicago',
                'America/New_York',
                'America/Phoenix',
              ].map((zone) => `<option value="${zone}" ${timezone === zone ? 'selected' : ''}>${zone}</option>`).join('')}
            </select>
          </div>
          <div class="actions">
            <button id="saveTargetsButton" class="btn-primary" type="button">Save + Recalculate</button>
            <button id="refreshButton" type="button">Refresh Data</button>
          </div>

          <div class="card">
            <h3>Data Status</h3>
            <div class="row"><span class="label">CRM</span><strong>${crmConnection.status || 'unknown'}</strong></div>
            <div class="row"><span class="label">Last Sync Status</span><strong>${latestSyncRun?.status || 'none yet'}</strong></div>
            <div class="row"><span class="label">Dashboard Timezone</span><strong>${timezone}</strong></div>
            <div class="row"><span class="label">Last Sync Finished</span><strong>${formatDateTime(latestSyncRun?.finishedAt, timezone)}</strong></div>
            <div class="row"><span class="label">Last Sync Records</span><strong>${latestSyncRun?.recordsPulled ?? 0}</strong></div>
            <div class="row"><span class="label">Last Sync Error</span><strong>${latestSyncRun?.errorMessage || crmConnection.lastError || 'none'}</strong></div>
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

          <div class="scoreline ${activeWeekScheduled >= targetMetrics.weeklyGoal ? 'good' : 'bad'}">
            <div>
              <div class="small">Scheduled production vs weekly goal</div>
              <div class="big">${targetMetrics.paceLabel}</div>
            </div>
            <div class="small">Current Week · ${activeWeek.range}</div>
          </div>

          <div class="week-nav">
            <div class="week-shell ${activeWeekKey === 'lastWeek' ? 'active' : ''} ${lastWeekGoalDelta >= 0 ? 'good' : 'bad'}" data-week="lastWeek">
              <div class="title">Last Week</div>
              <div class="range">${dashboard.weeks.lastWeek.range}</div>
              <div class="mini-note">${money.format(dashboard.weeks.lastWeek.scheduledProduction)} scheduled · ${money.format(lastApprovedSales)} sales · ${lastWeekGoalLabel}</div>
            </div>
            <div class="week-shell ${activeWeekKey === 'currentWeek' ? 'active' : ''}" data-week="currentWeek">
              <div class="title">Current Week</div>
              <div class="range">${dashboard.weeks.currentWeek.range}</div>
              <div class="mini-note">${money.format(currentScheduled)} scheduled · ${money.format(currentApprovedSales)} sales</div>
            </div>
            <div class="week-shell ${activeWeekKey === 'nextWeek' ? 'active' : ''}" data-week="nextWeek">
              <div class="title">Next Week</div>
              <div class="range">${dashboard.weeks.nextWeek.range}</div>
              <div class="mini-note">${money.format(dashboard.weeks.nextWeek.scheduledProduction)} scheduled</div>
            </div>
          </div>

          <div class="two">
            ${panel('Current Week View', `
              <div class="row"><span class="label">Range</span><strong>${activeWeek.range}</strong></div>
              <div class="row"><span class="label">Scheduled Production</span><strong>${money.format(activeWeekScheduled)}</strong></div>
              <div class="row"><span class="label">Approved Sales</span><strong>${money.format(activeWeekApprovedSales)}</strong></div>
              <div class="row"><span class="label">Last Sync</span><strong>${formatDateTime(crmConnection.last_sync_at || crmConnection.lastSyncAt, timezone)}</strong></div>
              <div class="tag live">Live</div>
            `)}
            ${panel('Sales Rollup', `
              <div class="row"><span class="label">Sales Today</span><strong>${money.format(salesToday)}</strong></div>
              <div class="row"><span class="label">Sales This Week</span><strong>${money.format(activeWeekApprovedSales)}</strong></div>
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
    document.getElementById('timezoneSelect').addEventListener('change', (event) => {
      writeTimezone(event.target.value);
      renderDashboard();
    });
    document.getElementById('refreshButton').addEventListener('click', async () => {
      try {
        status.textContent = 'Running live CRM sync…';
        const syncResult = await executeLiveSync();
        status.textContent = syncResult.message || 'Live CRM sync complete.';
        await renderDashboard();
      } catch (error) {
        status.textContent = `Live sync failed: ${error.message}`;
      }
    });

    if (!sessionStorage.getItem(AUTO_SYNC_STORAGE_KEY)) {
      sessionStorage.setItem(AUTO_SYNC_STORAGE_KEY, '1');
      try {
        status.textContent = 'Running automatic live CRM sync…';
        const syncResult = await executeLiveSync();
        status.textContent = syncResult.message || 'Automatic live CRM sync complete.';
        await renderDashboard();
        return;
      } catch (error) {
        status.textContent = `Automatic live sync failed: ${error.message}`;
      }
    }

    document.querySelectorAll('.week-shell[data-week]').forEach((node) => {
      node.addEventListener('click', () => {
        writeActiveWeek(node.dataset.week);
        renderDashboard();
      });
    });
  } catch (error) {
    status.textContent = `Failed to load dashboard: ${error.message}`;
  }
}

renderDashboard();
