# Murphy Live Flow

## Purpose
This is the live operating flow for Murphy inside ProfitStack.

The goal is not more features.
The goal is one clean repeatable session that works every time.

## Success definition
A Murphy session is successful when all of these are true:
1. login works
2. dashboard loads
3. Refresh Data runs
4. numbers update from live HCP data
5. the dashboard can be used to coach from the numbers immediately

## Murphy operator flow

### Step 1 — Login
- Open ProfitStack
- Authenticate successfully
- Confirm the dashboard loads without broken state

### Step 2 — Refresh live data
- Click `Refresh Data`
- Confirm the app completes the sync path
- Confirm the data shown is current enough to trust

### Step 3 — Read the dashboard
Use the launch metrics only:
- Scheduled Production
- Approved Sales
- Weekly Goal
- Company SPO
- Next 3 Weeks Scheduled

Do not drift into side metrics during the live session.

### Step 4 — Coach from the numbers
Use the dashboard to answer practical questions like:
- Are they above or below goal?
- Did approved sales move?
- Did scheduled production move?
- What does the next 3 weeks look like?
- Where is the pressure point right now?

## What counts as stable
Murphy flow is stable when:
- refresh works repeatedly
- values move when HCP changes
- no manual patching is needed
- no debug recovery steps are needed
- no browser weirdness is required to get current data

## What to ignore until after Murphy
- super-admin
- account management tooling
- extra dashboards
- internal-only reporting
- cosmetic rewrites

## Rule
If a change does not make the Murphy live flow more reliable, it waits.
