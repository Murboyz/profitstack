# ProfitStack V1 Metric Contract

## Purpose
This is the launch metric contract for Murphy and the first live clients.

Do not add, redefine, or reshuffle metrics casually.
If a metric changes, update this file in the same commit.

## V1 launch metrics

### 1) Scheduled Production
ProfitStack maintains **two parallel views** of scheduled production. They share the same source data; they differ only in how multi-day jobs are attributed.

#### 1a) HCP-aligned (default, persisted)
**Definition:**
Total dollar value of jobs whose **scheduled-start day** lands inside the selected week. Mirrors HCP **Reporting → Custom → Jobs by scheduled day** with no status filter, exactly.

**Source:**
Housecall Pro `jobDetails`. For each job we read `schedule.data.start_time` (with `scheduled_start`/`scheduled_at`/`scheduled_date` fallbacks), convert to a calendar day in the **org business timezone**, and add the full `total_amount` to the week containing that day.

**Rule:**
Do not split by visit/calendar item, do not redistribute across an invoice family, and do not pro-rate across weeks. Every job's `total_amount` lives entirely in its scheduled-start day, exactly like HCP's Jobs report.

**Used in:**
- Current Week card
- Last Week Snapshot
- Mini week tabs (last / current / next at the top of the dashboard)
- weekly goal comparison
- daily map (`rollups.dailyScheduledByDate`) that drives Month Production
- `week_metrics.scheduled_production` persistence and locked snapshots

#### 1b) Forecast view (Production Outlook only, in-memory)
**Definition:**
Same data as 1a, but multi-day jobs (`schedule.end_time` lands on a later business-TZ calendar day than `schedule.start_time`) are spread **evenly across the inclusive calendar-day span** of the schedule. Single-day jobs match 1a exactly.

**Example:**
A $58k install scheduled May 22 → May 27 (6 days) shows as **$29k on May 18–24** and **$29k on May 25–31** in the Production Outlook card, while the Current Week card and HCP Jobs report still show the full $58k on May 18–24 (the start week).

**Source:**
Computed during sync into `rollups.forecastByWeekStart` on the snapshot payload. **Never written into `week_metrics`** — it is recomputed every time the dashboard renders, so historical persistence (and HCP reconciliation) stay clean.

**Used in:**
- Production Outlook card **only** (next week, week+2, week+3)

**Implemented in:**
- `backend/src/server.mjs` → `fetchHousecallProSnapshot(...)` builds both `bucket.scheduledProduction` (1a) and `forecastByWeekStart` (1b), using `enumerateDayKeysInTimeZone(...)` for the span enumeration.
- The dashboard handler merges `forecastByWeekStart` onto `nextWeek / weekPlus2 / weekPlus3` only, exposing it as `scheduledProductionForecast`.

**Rule:**
The forecast view is a **deliberate productivity-view metric for crew load on future weeks**. It is allowed to disagree with HCP's Jobs-by-scheduled-day report; reconciliation against HCP must be done against view 1a (`scheduledProduction`).

---

### 2) Approved Sales
**Definition:**
Sales counted from approved/won estimate value using the currently trusted HCP live path.

**Source:**
Housecall Pro estimate/live sync path.

**Notes:**
This is the trusted launch approximation for approved sales.
Do not redefine it ad hoc in UI code.

**Used in:**
- week cards
- selected week view
- last week snapshot
- Company SPO

---

### 3) Weekly Goal
**Definition:**
Weekly break-even plus profit goal.

**Formula:**
`weekly_goal = (monthly_expense_target / 4) * (1 + profit_percent_goal / 100)`

**Defaults:**
- `profit_percent_goal` default = **10%**

**Used in:**
- weekly goal stat
- scheduled production vs goal scoreline
- last week goal comparison

---

### 4) Company SPO
**Definition:**
Approved sales divided by opportunities.

**Formula:**
`company_spo = approved_sales / opportunities`

**Source:**
- approved sales from HCP live sync
- opportunities from HCP live sync

**Rule:**
Do not use manual filler values for SPO in launch mode.

---

### 5) Next 3 Weeks Scheduled
**Definition:**
Sum of scheduled production for:
- next week
- week +2
- week +3

**Source:**
Housecall Pro scheduled job data.

**Used in:**
- production outlook

---

### 6) Month Production
**Definition:**
Scheduled production **attributed to calendar days** in the **current month** (org timezone). Each job’s scheduled start date buckets its amount into that calendar day; days are summed for `YYYY-MM`.

**Source (primary):**
Latest CRM snapshot rollup `rollups.dailyScheduledByDate`, built during sync from the same Jobs-by-scheduled-day pass that powers Scheduled Production (see metric #1). Each job's full `total_amount` is attributed to its scheduled-start calendar day in the org timezone, so May 1–2 jobs never roll into April even if they share a rolling Monday week with April.

**Fallback:**
If the snapshot has **no** daily map (legacy / empty pull), sum weekly `week_metrics` for every week interval that overlaps the month (full week row per overlap), with snapshot + override resolution per week.

**Used in:**
- dashboard "Month Production" stat
- admin client overview "Month production"

**Implemented in:**
- `backend/src/server.mjs` → `sumScheduledProductionForMonthFromDaily(...)` then `sumWeekMetricForMonth(...)` fallback

---

### 7) Sales Month
**Definition:**
Simple sum of every weekly Approved Sales for any week that overlaps the current month (in the org's timezone).

**Source:**
The same `week_metrics` rows that drive the weekly cards. Past weeks use their locked `approvedSalesSnapshot` override; the current week uses the live `approved_sales` value from the latest sync.

**Rule:**
"Sales This Month" on the dashboard and "Sales month" in the admin overview MUST share this single definition. Do NOT add a parallel "sales month" derived from HCP `jobDetails.created_at` or any other rollup. The persisted `setting.sales_month` column is legacy and is no longer the source of truth for these cards.

**Used in:**
- dashboard "Sales This Month" row (Sales Performance card)
- admin client overview "Sales month"

**Implemented in:**
- `backend/src/server.mjs` → `sumWeekMetricForMonth(..., 'approvedSalesSnapshot', 'approved_sales')`

---

## Not in V1 launch contract
These are explicitly out unless Chad says otherwise:
- completed production
- super-admin metrics
- internal ops-only reporting
- extra sales rollups that create noise (including any "sales month" computed from HCP `jobDetails.created_at`)
- prototype-only numbers with no live source
- confusing “full overlapping week” month totals when that disagrees with calendar-month job dates (weekly fallback only when daily map is absent)

## Launch rule
If a number is visible in V1, it must be one of:
1. live and trusted
2. clearly labeled manual
3. removed

Anything else is drift.
