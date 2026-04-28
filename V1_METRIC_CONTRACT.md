# ProfitStack V1 Metric Contract

## Purpose
This is the launch metric contract for Murphy and the first live clients.

Do not add, redefine, or reshuffle metrics casually.
If a metric changes, update this file in the same commit.

## V1 launch metrics

### 1) Scheduled Production
**Definition:**
Total dollar value of scheduled jobs for the selected week.

**Source:**
Housecall Pro calendar/job scheduling data.

**Used in:**
- week cards
- selected week view
- weekly goal comparison
- next 3 weeks outlook

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
Simple sum of every weekly Scheduled Production for any week that overlaps the current month (in the org's timezone).

**Source:**
The same `week_metrics` rows that drive the weekly cards. Past weeks use their locked `scheduledProductionSnapshot` override; the current week uses the live `scheduled_production` value from the latest sync.

**Rule:**
The Month Production card MUST equal the simple sum of the visible week cards for the month. It MUST NOT be re-derived from the HCP live calendar, daily HCP rollups, or any per-day attribution layer. If a week straddles two months, it counts at full value in BOTH months — by design, because that is what the user adds up from their own weekly report.

**Used in:**
- dashboard "Month Production" stat
- admin client overview "Month production"

**Implemented in:**
- `backend/src/server.mjs` → `sumWeekMetricForMonth(..., 'scheduledProductionSnapshot', 'scheduled_production')`

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
- pro-rated month attribution (was attempted, caused dashboard ≠ visible week sum, removed)

## Launch rule
If a number is visible in V1, it must be one of:
1. live and trusted
2. clearly labeled manual
3. removed

Anything else is drift.
