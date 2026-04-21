import { apiFetch, getCurrentUserEmail, requireLogin } from './auth.js';
import { renderSessionBanner } from './session-banner.js';
requireLogin();
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const TARGETS_STORAGE_KEY = 'profitstack_dashboard_targets';
const ACTIVE_WEEK_STORAGE_KEY = 'profitstack_dashboard_active_week';
const AUTO_SYNC_STORAGE_KEY = 'profitstack_dashboard_auto_sync_done';
const TIMEZONE_STORAGE_KEY = 'profitstack_dashboard_timezone';
const HISTORY_WEEK_STORAGE_KEY = 'profitstack_dashboard_history_week';
const EXPENSE_REMINDER_TEST_SEEN_KEY = 'profitstack_expense_reminder_test_seen';
const EXPENSE_REMINDER_MONTH_DONE_KEY = 'profitstack_expense_reminder_month_done';
const CRM_DISCONNECTED_NOTICE_KEY = 'profitstack_crm_disconnected_notice_seen';
const SETUP_STEP_STORAGE_KEY = 'profitstack_dashboard_setup_step';
const ADMIN_VIEW_ORG = new URLSearchParams(window.location.search).get('org');
const ADMIN_VIEW_MODE = Boolean(ADMIN_VIEW_ORG);

function panel(title, body) {
  return `<div class="panel"><h2>${title}</h2>${body}</div>`;
}

function deltaLabel(current = 0, previous = 0) {
  const delta = current - previous;
  if (delta === 0) return 'Flat vs last week';
  return delta > 0 ? `${money.format(delta)} above last week` : `${money.format(Math.abs(delta))} below last week`;
}

function profitLabel(weekRevenue = 0, weeklyBreakEven = 0) {
  const profit = weekRevenue - weeklyBreakEven;
  return {
    amount: profit,
    text: profit >= 0 ? `${money.format(profit)} profit` : `${money.format(Math.abs(profit))} loss`,
    className: profit >= 0 ? 'profit-good' : 'profit-bad',
  };
}

function readTargets(fallback = {}) {
  const defaults = { profitPercentGoal: 10 };
  try {
    const parsed = JSON.parse(localStorage.getItem(TARGETS_STORAGE_KEY) || '{}');
    const merged = { ...defaults, ...fallback, ...parsed };
    return merged;
  } catch {
    return { ...defaults, ...fallback };
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

function readHistoryWeek(defaultValue) {
  return localStorage.getItem(HISTORY_WEEK_STORAGE_KEY) || defaultValue;
}

function writeHistoryWeek(value) {
  localStorage.setItem(HISTORY_WEEK_STORAGE_KEY, value);
}

function getCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function isFirstMondayOfMonth(date = new Date()) {
  return date.getDay() === 1 && date.getDate() <= 7;
}

function shouldShowExpenseReminder(date = new Date()) {
  const monthKey = getCurrentMonthKey(date);
  const completedMonth = localStorage.getItem(EXPENSE_REMINDER_MONTH_DONE_KEY);
  if (!localStorage.getItem(EXPENSE_REMINDER_TEST_SEEN_KEY)) return true;
  return isFirstMondayOfMonth(date) && completedMonth !== monthKey;
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

function collectTargetInputs(baseTargets = {}) {
  return {
    ...baseTargets,
    monthlyExpenseTarget: document.getElementById('monthlyExpenseTarget')?.value ?? baseTargets.monthlyExpenseTarget,
    profitPercentGoal: document.getElementById('profitPercentGoal')?.value ?? baseTargets.profitPercentGoal,
    opportunityCount: baseTargets.opportunityCount,
    salesToday: baseTargets.salesToday,
    salesMonth: baseTargets.salesMonth,
    salesYear: baseTargets.salesYear,
  };
}

function bindTargetInputs(baseTargets) {
  const save = async () => {
    const payload = collectTargetInputs(baseTargets);
    writeTargets(payload);
    await apiFetch('/api/account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    renderDashboard();
  };

  ['monthlyExpenseTarget', 'profitPercentGoal']
    .forEach((id) => document.getElementById(id).addEventListener('change', save));
}

function bindSetupGuidance(setupMode) {
  if (!setupMode) {
    sessionStorage.removeItem(SETUP_STEP_STORAGE_KEY);
    return () => {};
  }

  const monthlyField = document.getElementById('monthlyExpenseTarget')?.closest('.field');
  const profitField = document.getElementById('profitPercentGoal')?.closest('.field');
  const timezoneField = document.getElementById('timezoneSelect')?.closest('.field');
  const refreshButton = document.getElementById('refreshButton');
  const monthlyInput = document.getElementById('monthlyExpenseTarget');
  const profitInput = document.getElementById('profitPercentGoal');
  const timezoneSelect = document.getElementById('timezoneSelect');
  const helper = document.getElementById('setupHelper');
  if (!monthlyField || !profitField || !timezoneField || !refreshButton || !monthlyInput || !profitInput || !timezoneSelect || !helper) return () => {};

  let activeStep = sessionStorage.getItem(SETUP_STEP_STORAGE_KEY) || 'monthly';

  const applyStep = () => {
    sessionStorage.setItem(SETUP_STEP_STORAGE_KEY, activeStep);
    monthlyField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    profitField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    timezoneField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    refreshButton.classList.remove('setup-ready');

    if (activeStep === 'monthly') {
      helper.innerHTML = '<strong>Step 1:</strong> enter Monthly Expense Target, then press Enter.';
      monthlyField.classList.add('setup-focus');
      profitField.classList.add('setup-done');
      timezoneField.classList.add('setup-done');
      monthlyInput.focus();
      monthlyInput.select();
      return;
    }
    if (activeStep === 'profit') {
      helper.innerHTML = '<strong>Step 2:</strong> enter Profit % Goal, then press Enter.';
      monthlyField.classList.add('setup-static');
      profitField.classList.add('setup-focus');
      timezoneField.classList.add('setup-done');
      profitInput.focus();
      profitInput.select();
      return;
    }
    if (activeStep === 'timezone') {
      helper.innerHTML = '<strong>Step 3:</strong> choose your timezone, then press Enter.';
      monthlyField.classList.add('setup-static');
      profitField.classList.add('setup-static');
      timezoneField.classList.add('setup-focus');
      timezoneSelect.focus();
      return;
    }
    helper.innerHTML = '<strong>Step 4:</strong> click Refresh Data.';
    monthlyField.classList.add('setup-static');
    profitField.classList.add('setup-static');
    timezoneField.classList.add('setup-static');
    refreshButton.classList.add('setup-ready');
    refreshButton.focus();
  };

  monthlyInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    activeStep = 'profit';
    sessionStorage.setItem(SETUP_STEP_STORAGE_KEY, activeStep);
    monthlyInput.dispatchEvent(new Event('change'));
    window.setTimeout(applyStep, 50);
  });

  profitInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    activeStep = 'timezone';
    sessionStorage.setItem(SETUP_STEP_STORAGE_KEY, activeStep);
    profitInput.dispatchEvent(new Event('change'));
    window.setTimeout(applyStep, 50);
  });

  timezoneSelect.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    activeStep = 'refresh';
    window.setTimeout(applyStep, 50);
  });

  timezoneSelect.addEventListener('change', () => {
    if (activeStep === 'timezone') {
      activeStep = 'refresh';
      sessionStorage.setItem(SETUP_STEP_STORAGE_KEY, activeStep);
      window.setTimeout(applyStep, 50);
    }
  });

  applyStep();

  return () => {
    monthlyField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    profitField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    timezoneField.classList.remove('setup-focus', 'setup-done', 'setup-static');
    refreshButton.classList.remove('setup-ready');
    helper.innerHTML = '';
  };
}

function bindMobileControlPanelHide() {
  const controlPanel = document.querySelector('.control-panel');
  const timezoneField = document.getElementById('timezoneSelect');
  if (!controlPanel || !timezoneField) return;

  if (window.__profitstackMobileControlPanelHandler) {
    window.removeEventListener('scroll', window.__profitstackMobileControlPanelHandler);
    window.removeEventListener('resize', window.__profitstackMobileControlPanelHandler);
  }

  const mediaQuery = window.matchMedia('(max-width: 980px)');
  const updateVisibility = () => {
    if (!mediaQuery.matches) {
      controlPanel.classList.remove('mobile-hidden');
      return;
    }
    const threshold = timezoneField.getBoundingClientRect().bottom;
    controlPanel.classList.toggle('mobile-hidden', threshold <= 0);
  };

  window.__profitstackMobileControlPanelHandler = updateVisibility;
  updateVisibility();
  window.addEventListener('scroll', updateVisibility, { passive: true });
  window.addEventListener('resize', updateVisibility);
}

async function loadJson(path) {
  const separator = path.includes('?') ? '&' : '?';
  const res = await apiFetch(`${path}${separator}t=${Date.now()}`);
  if (!res.ok) throw new Error(`${path} failed with ${res.status}`);
  return res.json();
}

function showSyncOverlay() {
  const existing = document.getElementById('syncOverlay');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'syncOverlay';
  overlay.className = 'sync-overlay';
  overlay.innerHTML = `
    <div class="sync-overlay-card">
      <h3>Refreshing your live report…</h3>
      <p>Please wait 30 to 60 seconds while The Nut Report pulls fresh CRM data and rebuilds your dashboard.</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideSyncOverlay() {
  document.getElementById('syncOverlay')?.remove();
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
  const navLinks = document.querySelector('.nav-links');

  try {
    if (navLinks && ADMIN_VIEW_MODE) {
      navLinks.innerHTML = '<a href="./admin.html">Return to Admin</a><a href="./account.html">Account</a><a href="./logout.html">Logout</a>';
    }
    if (status) status.textContent = 'Refreshing dashboard…';
    await renderSessionBanner();
    const [session, dashboard, crmConnection, overrides, syncRuns, health] = await Promise.all([
      loadJson('/api/session'),
      loadJson('/api/dashboard'),
      loadJson('/api/crm-connection'),
      loadJson('/api/overrides'),
      loadJson('/api/sync-runs'),
      loadJson('/api/health')
    ]);

    if (status) status.textContent = `Loaded ${session.organization.name} · ${session.user.email} · CRM ${crmConnection.provider} · ${crmConnection.status}`;

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
    const savedTargets = readTargets(dashboard.settings || {});
    const monthlyExpenseTarget = parseNumber(savedTargets.monthlyExpenseTarget || 0);
    const profitPercentGoal = parseNumber(savedTargets.profitPercentGoal || 0);
    const opportunityCount = parseNumber(savedTargets.opportunityCount || 0);
    const salesToday = parseNumber(dashboard.settings?.salesToday ?? 0);
    const currentWeekApprovedDisplay = currentApprovedSales;
    const activeWeekApprovedDisplay = activeWeekKey === 'currentWeek'
      ? currentWeekApprovedDisplay
      : activeWeekApprovedSales;
    const salesWeek = currentWeekApprovedDisplay;
    const salesMonth = parseNumber(dashboard.settings?.salesMonth ?? 0);
    const visiblePastWeeksTotal = previousWeekHistory
  .slice(0, 3)
  .reduce((sum, week) => sum + parseNumber(week.scheduledProduction || 0), 0);

    const previousWeekHistory = (dashboard.weekHistory || [])
      .filter((week) => week.weekStartDate < dashboard.weeks.currentWeek.weekStartDate)
      .slice(-6)
      .reverse();
const visiblePastWeeksTotal = previousWeekHistory
  .slice(0, 3)
  .reduce((sum, week) => sum + parseNumber(week.scheduledProduction || 0), 0);

const productionOutlookTotal =
  parseNumber(dashboard.weeks.nextWeek.scheduledProduction || 0) +
  parseNumber(dashboard.weeks.weekPlus2.scheduledProduction || 0) +
  parseNumber(dashboard.weeks.weekPlus3.scheduledProduction || 0);

const monthScheduledProduction =
  visiblePastWeeksTotal +
  parseNumber(dashboard.weeks.currentWeek.scheduledProduction || 0) +
  productionOutlookTotal;

const monthlyProductionDelta = 0;

    const defaultHistoryWeek = previousWeekHistory[0]?.weekStartDate || dashboard.weeks.lastWeek.weekStartDate;
    const historyWeekKey = readHistoryWeek(defaultHistoryWeek);
    const selectedHistoryWeek = previousWeekHistory.find((week) => week.weekStartDate === historyWeekKey) || previousWeekHistory[0] || {
      range: dashboard.weeks.lastWeek.range,
      scheduledProduction: dashboard.weeks.lastWeek.scheduledProduction,
      approvedSales: lastApprovedSales,
      scheduledProductionSnapshot: dashboard.weeks.lastWeek.scheduledProduction,
      approvedSalesSnapshot: lastApprovedSales,
      weekStartDate: dashboard.weeks.lastWeek.weekStartDate,
    };
    const targetMetrics = computeTargets(monthlyExpenseTarget, profitPercentGoal, activeWeekScheduled);
    const selectedHistoryScheduled = selectedHistoryWeek.scheduledProductionSnapshot ?? selectedHistoryWeek.scheduledProduction ?? 0;
    const selectedHistoryApproved = selectedHistoryWeek.approvedSalesSnapshot ?? selectedHistoryWeek.approvedSales ?? 0;
    const selectedHistoryBreakEven = selectedHistoryWeek.weeklyBreakEvenSnapshot ?? targetMetrics.weeklyBreakEven;
    const selectedHistoryProfit = profitLabel(selectedHistoryScheduled, selectedHistoryBreakEven);
    const companySpo = computeCompanySpo(activeWeekApprovedSales, opportunityCount);
    const lastWeekGoalDelta = (dashboard.weeks.lastWeek.scheduledProduction || 0) - targetMetrics.weeklyGoal;
    const lastWeekGoalLabel = lastWeekGoalDelta >= 0
      ? `${money.format(lastWeekGoalDelta)} over goal`
      : `${money.format(Math.abs(lastWeekGoalDelta))} below goal`;

    const searchParams = new URLSearchParams(window.location.search);
    const setupMode = !ADMIN_VIEW_MODE && searchParams.get('setup') === '1';
    const showExpenseReminder = !ADMIN_VIEW_MODE && shouldShowExpenseReminder();
    const disconnectedNoticeForced = searchParams.get('crm') === 'disconnected';
    const showDisconnectedModal = !ADMIN_VIEW_MODE && crmConnection.status === 'disconnected' && (disconnectedNoticeForced || !sessionStorage.getItem(CRM_DISCONNECTED_NOTICE_KEY));
    if (crmConnection.status === 'connected') {
      sessionStorage.removeItem(CRM_DISCONNECTED_NOTICE_KEY);
    }

    app.innerHTML = `
      <div class="layout">
        <section class="panel control-panel ${setupMode ? 'setup-mode' : ''}">
          <h2>Control Panel</h2>
          ${ADMIN_VIEW_MODE ? '<div class="clientbar"><strong>Admin view:</strong> this is a read-only client dashboard view. <a href="./admin.html">Return to admin panel</a></div>' : ''}
          ${setupMode ? '<div class="setup-helper" id="setupHelper"></div>' : ''}
          <div class="clientbar"><strong>${ADMIN_VIEW_MODE ? 'Client view:' : 'Live controls:'}</strong> ${ADMIN_VIEW_MODE ? 'you are seeing this client dashboard without switching into their login.' : 'adjust targets, sync fresh data, and coach from the numbers.'}</div>

          <div class="field">
            <label for="monthlyExpenseTarget">Monthly Expense Target</label>
            <input id="monthlyExpenseTarget" value="${savedTargets.monthlyExpenseTarget ?? ''}" placeholder="35000" ${ADMIN_VIEW_MODE ? 'disabled' : ''} />
          </div>
          <div class="field">
            <label for="profitPercentGoal">Profit % Goal</label>
            <input id="profitPercentGoal" value="${savedTargets.profitPercentGoal ?? ''}" placeholder="10" ${ADMIN_VIEW_MODE ? 'disabled' : ''} />
          </div>
          <div class="field">
            <label for="timezoneSelect"><strong>Time Zone</strong></label>
            <select id="timezoneSelect" ${ADMIN_VIEW_MODE ? 'disabled' : ''}>
              ${[
                ['America/Los_Angeles', 'Pacific'],
                ['America/Denver', 'Mountain'],
                ['America/Chicago', 'Central'],
                ['America/New_York', 'Eastern'],
                ['America/Phoenix', 'Arizona'],
              ].map(([zone, label]) => `<option value="${zone}" ${timezone === zone ? 'selected' : ''}>${label}</option>`).join('')}
            </select>
          </div>
          <div class="actions">
            <button id="refreshButton" type="button" ${ADMIN_VIEW_MODE ? 'disabled' : ''}>Refresh Data</button>
          </div>
          <div class="muted">${ADMIN_VIEW_MODE ? 'Admin client view is read-only.' : 'Targets auto-save when you change them.'}</div>

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

        <section class="${setupMode ? 'setup-dim' : ''}">
          ${''}
          ${crmConnection.status === 'disconnected' ? `
            <div class="alertbar">
              <div>
                <strong>Housecall Pro is disconnected.</strong><br />
                Your last synced numbers are still here, but the next refresh needs a reconnect.
              </div>
              <a href="./crm.html?onboarding=connect-crm">Reconnect Housecall Pro</a>
            </div>
          ` : ''}
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
            <div class="stat ${monthlyProductionDelta >= 0 ? 'green' : 'red'}">
              <div class="k">Month Production</div>
              <div class="v">${money.format(monthScheduledProduction)}</div>
              <div class="note">${monthlyProductionDelta >= 0 ? money.format(monthlyProductionDelta) + ' over target' : money.format(Math.abs(monthlyProductionDelta)) + ' under target'}</div>
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
              <div class="mini-note">${money.format(currentScheduled)} scheduled · ${money.format(currentWeekApprovedDisplay)} sales</div>
            </div>
            <div class="week-shell ${activeWeekKey === 'nextWeek' ? 'active' : ''}" data-week="nextWeek">
              <div class="title">Next Week</div>
              <div class="range">${dashboard.weeks.nextWeek.range}</div>
              <div class="mini-note">${money.format(dashboard.weeks.nextWeek.scheduledProduction)} scheduled</div>
            </div>
          </div>

          <div class="two">
            ${panel('Current Week', `
              <div class="row"><span class="label">Range</span><strong>${activeWeek.range}</strong></div>
              <div class="row"><span class="label">Scheduled Production</span><strong>${money.format(activeWeekScheduled)}</strong></div>
              <div class="row"><span class="label">Approved Sales</span><strong>${money.format(activeWeekApprovedDisplay)}</strong></div>
              <div class="tag live">Live</div>
            `)}
            ${panel('Sales Performance', `
              <div class="row"><span class="label">Sales Today</span><strong>${money.format(salesToday)}</strong></div>
              <div class="row"><span class="label">Sales This Week</span><strong>${money.format(salesWeek)}</strong></div>
              <div class="row"><span class="label">Sales This Month</span><strong>${money.format(salesMonth)}</strong></div>
              <div class="tag manual">Manual + live</div>
            `)}
            ${panel('Last Week Snapshot', `
              <div class="field">
                <label for="historyWeekSelect">Snapshot Week</label>
                <select id="historyWeekSelect">
                  ${previousWeekHistory.map((week) => `<option value="${week.weekStartDate}" ${selectedHistoryWeek.weekStartDate === week.weekStartDate ? 'selected' : ''}>${week.range}</option>`).join('')}
                </select>
              </div>
              <div class="row"><span class="label">Range</span><strong>${selectedHistoryWeek.range}</strong></div>
              <div class="row"><span class="label">Approved Sales</span><strong>${money.format(selectedHistoryApproved)}</strong></div>
              <div class="row"><span class="label">Scheduled Production</span><strong>${money.format(selectedHistoryScheduled)}</strong></div>
              <div class="row"><span class="label">Profit</span><strong class="${selectedHistoryProfit.className}">${selectedHistoryProfit.text}</strong></div>
              <div class="tag live">Live</div>
            `)}
            ${panel('Production Outlook', `
              <div class="row"><span class="label">${dashboard.weeks.nextWeek.range}</span><strong>${money.format(dashboard.weeks.nextWeek.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">${dashboard.weeks.weekPlus2.range}</span><strong>${money.format(dashboard.weeks.weekPlus2.scheduledProduction)}</strong></div>
              <div class="row"><span class="label">${dashboard.weeks.weekPlus3.range}</span><strong>${money.format(dashboard.weeks.weekPlus3.scheduledProduction)}</strong></div>
              <div class="tag live">Live</div>
            `)}
          </div>
        </section>
      </div>
      ${showExpenseReminder ? `
        <div class="modal-backdrop" id="expenseReminderModal">
          <div class="modal-card">
            <h3>Update Monthly Expense Target</h3>
            <p>Before moving forward, enter this month’s estimated expenses. This reminder will come back on the first Monday of each new month.</p>
            <div class="field">
              <label for="expenseReminderInput">Estimated Monthly Expenses</label>
              <input id="expenseReminderInput" value="${monthlyExpenseTarget || ''}" placeholder="35000" />
            </div>
            <div class="actions">
              <button id="expenseReminderSave" class="btn-primary" type="button">Save Monthly Expenses</button>
            </div>
          </div>
        </div>
      ` : ''}
      ${showDisconnectedModal ? `
        <div class="modal-backdrop" id="crmDisconnectedModal">
          <div class="modal-card">
            <h3>Housecall Pro is disconnected</h3>
            <p>For the best reconnect experience, use a computer. If Housecall Pro is already logged in on this computer, the reconnect should open already signed in. If not, log in there, then come back to see the reporting and connection on your dashboard. Your reporting is still visible right now, but the next live refresh needs Housecall Pro reconnected.</p>
            <div class="actions">
              <a href="https://pro.housecallpro.com/app/log_in" target="_blank" rel="noreferrer" class="btn-primary" id="crmReconnectLink">Login / Reconnect Housecall Pro</a>
              <button id="crmDisconnectedContinue" type="button">Keep viewing dashboard</button>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    if (!ADMIN_VIEW_MODE) {
      bindTargetInputs(savedTargets);
      document.getElementById('timezoneSelect').addEventListener('change', (event) => {
        writeTimezone(event.target.value);
        renderDashboard();
      });
    }
    const expenseReminderSave = document.getElementById('expenseReminderSave');
    if (expenseReminderSave) {
      expenseReminderSave.addEventListener('click', () => {
        const reminderValue = parseNumber(document.getElementById('expenseReminderInput')?.value || 0);
        if (!reminderValue) return;
        document.getElementById('monthlyExpenseTarget').value = reminderValue;
        document.getElementById('monthlyExpenseTarget').dispatchEvent(new Event('change'));
        localStorage.setItem(EXPENSE_REMINDER_TEST_SEEN_KEY, '1');
        localStorage.setItem(EXPENSE_REMINDER_MONTH_DONE_KEY, getCurrentMonthKey());
      });
    }
    const crmDisconnectedContinue = document.getElementById('crmDisconnectedContinue');
    if (crmDisconnectedContinue) {
      crmDisconnectedContinue.addEventListener('click', () => {
        sessionStorage.setItem(CRM_DISCONNECTED_NOTICE_KEY, '1');
        const modal = document.getElementById('crmDisconnectedModal');
        if (modal) modal.remove();
        const url = new URL(window.location.href);
        url.searchParams.delete('crm');
        window.history.replaceState({}, '', `${url.pathname}${url.search}`);
      });
    }
    const crmReconnectLink = document.getElementById('crmReconnectLink');
    if (crmReconnectLink) {
      crmReconnectLink.addEventListener('click', () => {
        sessionStorage.setItem(CRM_DISCONNECTED_NOTICE_KEY, '1');
      });
    }
    const historyWeekSelect = document.getElementById('historyWeekSelect');
    if (historyWeekSelect) {
      historyWeekSelect.addEventListener('change', (event) => {
        writeHistoryWeek(event.target.value);
        renderDashboard();
      });
    }
    const cleanupSetupGuidance = bindSetupGuidance(setupMode);
    if (!ADMIN_VIEW_MODE) {
      document.getElementById('refreshButton').addEventListener('click', async () => {
        try {
          cleanupSetupGuidance();
          showSyncOverlay();
          if (status) status.textContent = 'Running live CRM sync. Please wait 30 to 60 seconds…';
          const syncResult = await executeLiveSync();
          if (status) status.textContent = syncResult.message || 'Live CRM sync complete.';
          const url = new URL(window.location.href);
          url.searchParams.delete('setup');
          sessionStorage.removeItem(SETUP_STEP_STORAGE_KEY);
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
          await renderDashboard();
        } catch (error) {
          if (status) status.textContent = `Live sync failed: ${error.message}`;
        } finally {
          hideSyncOverlay();
        }
      });
    }

    if (!ADMIN_VIEW_MODE && !sessionStorage.getItem(AUTO_SYNC_STORAGE_KEY) && crmConnection.status !== 'disconnected') {
      sessionStorage.setItem(AUTO_SYNC_STORAGE_KEY, '1');
      try {
        if (status) status.textContent = 'Running automatic live CRM sync…';
        const syncResult = await executeLiveSync();
        if (status) status.textContent = syncResult.message || 'Automatic live CRM sync complete.';
        await renderDashboard();
        return;
      } catch (error) {
        if (status) status.textContent = `Automatic live sync failed: ${error.message}`;
      }
    }

    document.querySelectorAll('.week-shell[data-week]').forEach((node) => {
      node.addEventListener('click', () => {
        writeActiveWeek(node.dataset.week);
        renderDashboard();
      });
    });
    bindMobileControlPanelHide();
  } catch (error) {
    if (status) status.textContent = `Failed to load dashboard: ${error.message}`;
  }
}

renderDashboard();
