# ProfitStack Session Handoff

## Purpose
Use this file to bootstrap a new dedicated ProfitStack session without losing the old session context.

## Current status
- Estimated completion toward first live pilot shape: **78%**
- Current stage: **public-facing Core offer, mobile/public UX tightened, reporting-card coupling bug fixed, deeper sales-truth work still pending**

## Live now
- Supabase project connected
- schema applied
- organizations table live
- users table live
- week metrics live
- metric overrides live and writable
- CRM connection live and writable
- sync runs live
- one-server Node app serves frontend + API
- browser status page exists
- org-scoped backend context exists
- session endpoint exists
- login shell exists
- multi-org test flow exists

## Main URLs
- Live app: `https://profitstack.onrender.com/`
- Live login: `https://profitstack.onrender.com/login.html`
- Live CRM: `https://profitstack.onrender.com/crm.html`
- Live health: `https://profitstack.onrender.com/api/health`
- Local app: `http://127.0.0.1:8787/`
- Local status: `http://127.0.0.1:8787/status.html`

## Main files
- `profitstack/backend/src/server.mjs`
- `profitstack/backend/src/supabase-client.mjs`
- `profitstack/frontend/app/`
- `profitstack/supabase/migrations/001_initial_schema.sql`
- `profitstack/supabase/seeds/`
- `profitstack/STATUS.md`
- `profitstack/BUILD_QUEUE.md`
- `profitstack/AUTONOMOUS_RULES.md`
- `profitstack/DEPLOY.md`

## Active architecture
- one Node server for app + API
- live Supabase backend using service-role access
- frontend login shell stores current email locally
- backend resolves user -> organization and scopes data by organization_id

## Seeded orgs/users
### Org 1
- Stop Working Broke
- user: `chad@stopworkingbroke.com`

### Org 2
- Northfield Service Co
- user: `owner@northfieldserviceco.com`

### Org 3
- Murphy
- user: `outsidethebusinessbox@gmail.com`
- Murphy org login works via magic link
- Murphy CRM connection is saved and sync runs succeed
- Current problem: Murphy metrics are still wrong because the HCP mapper is undercounting / not populating approved sales and opportunities

## Remaining major tasks
1. fix Murphy HCP metric mapping so live numbers are trusted
2. prove Murphy live flow cleanly end-to-end
3. remove temporary debug UI once stable
4. replace login shell with real Supabase Auth
5. add row-level security / stronger tenant hardening
6. improve onboarding and go-to-market assets

## Important note
This project got mixed with unrelated lead-machine heartbeat traffic because the current webchat UI exposes only one visible chat session. The ProfitStack project itself was **not deleted**.

## Instruction for new session
When starting a new dedicated ProfitStack session:
- read this file first
- read `profitstack/LAUNCH_FREEZE.md`
- read `profitstack/V1_METRIC_CONTRACT.md`
- read `profitstack/MURPHY_LIVE_FLOW.md`
- continue from: **fix Murphy HCP metric mapping**

## Critical context from today
- 2026-04-12 lane correction: live Nut Report deploy work must happen in the real repo at `/home/outsidethebusinessbox/.openclaw/workspace/profitstack`, not the workspace-root repo. Earlier root-level commits were the wrong lane. For app/site changes, commit and push inside `profitstack/` only.
- Pricing is now locked for the current offer: **Core = $197/month**. Future tiers are **Pro** and **Elite**. Stripe naming should use **`The Nut Report - Core`**.
- Homepage/marketing work shipped today in the ProfitStack repo: screenshot assets live in `frontend/app/assets/`, screenshot cards have clearer labels, clicking screenshots opens a lightbox, hero CTA was rewritten and centered as a card-style signup block, and public/legal pages got a mobile pass.
- Mobile/dashboard UX work shipped today: core app pages were made mobile-safer, the dashboard control panel now gets out of the way on mobile after the timezone section scrolls past, and extra spacing was added so the Month Production card is visible after that transition.
- Reporting bug fixed today: changing Monthly Expense Target had been incorrectly affecting reporting cards because `/api/account` saves were coupled to sales rollup fields. Fixes landed in the repo to preserve reporting values on target saves and make dashboard reporting cards fall back to the latest live CRM snapshot rollups instead of depending only on nullable `organization_settings` fields.
- Today’s key ProfitStack repo commits, in order, were: `8420008` (equal-sized homepage screenshots), `56765ef` (preserve sales reporting on account target save), `82f799a` (use live snapshot rollups for dashboard reporting cards), `78aeb8b` (new screenshots + lightbox), `b0e5d78` (screenshot labels), `e1e462d` (hero headline + CTA), `61ae80e` (restyled signup CTA), `34df901` (center signup CTA across hero), `7288225` (core mobile responsiveness), `8e7a7af` (legal-page mobile polish), `fd91946` (hide mobile control panel after timezone), `0616afe` (mobile spacing above Month Production after panel hide).
- Current likely tonight pickup order: (1) verify live deployed site reflects the latest ProfitStack repo commits, (2) continue tightening any remaining mobile/UI rough edges only if Chad spots them live, (3) then return to deeper reporting truth work instead of drifting into more surface tweaks.
- Do not drift into workspace-root or prototype paths; work in `profitstack/` only.
- After every committed ProfitStack change, immediately give Chad the exact push/deploy step.
- The live Render app now has working login, CRM save, and Refresh wiring.
- Murphy HCP auth is connected, but the metric mapping is still wrong.
- Multi-segment / multi-visit job allocation was introduced as a reporting experiment; if that change breaks trusted production reporting, roll back to the pre-allocation baseline and re-evaluate instead of stacking more patches.
- Long-span single jobs (example: job `10277`, $15,406, Apr 6–Apr 24) now have a separate prorating experiment committed in `549b08f`; if reporting gets worse, come back to this checkpoint before adding more schedule math.
- Late-session UI/product changes shipped on top of Murphy live flow: compact timezone control moved into the left dashboard card, redundant status card removed, previous week history folded into Last Week Snapshot via dropdown, monthly expense reminder modal added (forced now for test, then first Monday each month), nav converted to centered buttons, app renamed in visible branding to `The Nut Report`, and styling pass improved hierarchy/control-panel feel.
- Sales/approved-sales status at end of session: scheduled production is trusted enough to demo, but approved-sales timing from HCP is still not truly sourced by approval-date truth. Display patches were added for today/week/month rollups, but the remaining real backend task is finding HCP's true `approved today` source and replacing the patched path.
- If this chat/session is lost, resume from this file plus `memory/2026-04-08.md`, then continue with: (1) true HCP approved-today source, (2) domain cutover to `https://thenutreport.com`, (3) any remaining UI cleanup after data truth is locked.
- 2026-04-09 handoff: the core lane is unchanged — production is mostly trusted, sales truth is still broken because the native HCP approval source is not yet isolated. Chad explicitly rejected proxy-event logic and wants the exact native source only. Browser/CDP access was partially restored by manually launching Chromium on `127.0.0.1:18800`, which re-opened live HCP reporting UI access and exposed `/alpha/reporting/dashboards` and `/alpha/reporting/starter_state`, but the exact approval-date request still was not isolated.
- Additive product work completed on 2026-04-09 while sales truth remained unresolved: (1) client-facing CRM setup flow simplified, (2) landing page added at `frontend/app/website.html`, (3) password auth moved to password-first login with Account-page password change flow, (4) Profit % Goal now allows manual `0`, and (5) new production-derived sales metrics were added and surfaced: `realizedSales3Weeks` and `capturedSales6Weeks`.
- Immediate tomorrow pickup order: (1) resume from live HCP reporting/browser lane only, (2) isolate native approval-date source or conclude it is internal-only, (3) if still inaccessible, decide whether Nut Report ships with production + additive production-derived sales metrics while approval-truth remains unresolved, (4) domain cutover later.
- 2026-04-10 saved-product checkpoint: if sales logic drifts again, return to this checkpoint first before trying new experiments. Locked product behavior at this checkpoint is: (a) production outlook stays tied to scheduled-production week buckets, (b) visible sales rollups are based on jobs created this week / this month using HCP `created_at` + `total_amount`, (c) `Sales Today` is shown separately and must not be added a second time into weekly/monthly totals, (d) old approved-sales override paths must not mask fresh synced values, (e) job `10821` was traced successfully through fetch inputs (`jobs_list`, calendar payload, and job detail lookup), proving that downstream bucketing/write logic — not discovery — was the blocker, (f) the dashboard view should hide Realized/Captured rows, remove Last Sync from Current Week, and remove Next 3 Weeks Total from Production Outlook, and (g) a local hard backup archive was created at `~/profitstack-backups/profitstack-20260410-182324.tgz`.
- Regression protection now exists in-repo at `scripts/check-nut-report-regression.js`. It currently validates Sales Today / Week / Month and the Month Production card. Current state: sales checks pass; month production check still flags mismatch (`expected 55435.6`, `actual 76896.6`), so that card is not yet as trustworthy as the sales card.
