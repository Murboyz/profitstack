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

## Not in V1 launch contract
These are explicitly out unless Chad says otherwise:
- completed production
- super-admin metrics
- internal ops-only reporting
- extra sales rollups that create noise
- prototype-only numbers with no live source

## Launch rule
If a number is visible in V1, it must be one of:
1. live and trusted
2. clearly labeled manual
3. removed

Anything else is drift.
