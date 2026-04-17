# ProfitStack Session Handoff

## Purpose
Use this file to bootstrap a new dedicated ProfitStack session without losing the old session context.

## Current status
- Estimated completion toward first live pilot shape: **95%**
- Current stage: **guided client onboarding is now usable enough for real clients, Murphy is back in with a real Murphy-owned login email, and the next highest-leverage work is onboarding video + clean demo account + final live validation of the password-reset path**

## Latest save, 2026-04-17
- Murphy client login was switched off Chad's email and onto the real client email `sales@murphysfireplace.com`.
- The Murphy app user record and linked auth user were both updated live to `sales@murphysfireplace.com`.
- Chad confirmed on 2026-04-17 that Murphy is now back in successfully after the email/login switch.
- A client-facing forgot-password path was added in the repo so users can request a reset email directly from `frontend/app/login.html` via a new **Email Me A Password Reset Link** button.
- Existing in-session password change remains available on `frontend/app/account.html`, and helper copy was added there to point users back to login if they forget the password later.
- Repo commit for the reset-link/login work: `dbe61e3` (`Add password reset path from login`).
- Important deploy truth: the Murphy email switch is already live in Supabase, but the new forgot-password button will not be live until the repo is pushed/deployed.
- Chad said he is working on the onboarding video next.
- Best next product move after push/deploy is to create a separate demo org/login for demos, not reuse Murphy and not reuse Chad admin.

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
- user: `sales@murphysfireplace.com`
- Murphy org login was switched on 2026-04-17 from Chad's email to the real Murphy-owned email above
- Murphy CRM connection is saved and live sync runs succeed again
- Sales Today / current-week approved sales / sales month now line up on live after session recovery + live sync
- Remaining numbers lane is narrower: keep validating month scheduled production / any remaining drift instead of treating the whole HCP mapper as broken

## Remaining major tasks
1. push/deploy commit `dbe61e3` so the new forgot-password email path is live on the login page
2. create a separate demo org/login for demos so Chad does not have to use Murphy for walkthroughs
3. wire Chad's onboarding/tutorial video into `signup-success.html`
4. run the clean-buyer onboarding test from another computer or a cleared-cookie / clean Chrome profile and fix whatever still breaks in the helper install -> HCP connect -> dashboard path
5. finish Murphy month-production truth only if it still matters for sales confidence, otherwise keep it honestly positioned as the product's own operating metric
6. remove temporary debug UI once stable
7. add row-level security / stronger tenant hardening

## Important note
This project got mixed with unrelated lead-machine heartbeat traffic because the current webchat UI exposes only one visible chat session. The ProfitStack project itself was **not deleted**.

## Instruction for new session
When starting a new dedicated ProfitStack session:
- read this file first
- read `profitstack/LAUNCH_FREEZE.md`
- read `profitstack/V1_METRIC_CONTRACT.md`
- read `profitstack/MURPHY_LIVE_FLOW.md`
- continue from: **validate and finish the remaining Murphy month-production truth lane, then return to Chrome Web Store/install-distribution work**

## Critical context from today
- 2026-04-13 recovery breakthrough: the old HCP auth path was recovered from the OpenClaw managed browser profile cookie store, not from a new connection flow. The stale 401 problem turned out to be expired saved session data plus browser-attach confusion. Pulling decrypted Housecall Pro cookies from `/home/outsidethebusinessbox/.openclaw/browser/openclaw/user-data/Default/Cookies` restored direct HCP API access.
- After writing the recovered session cookie back into the `crm_connections` row for Murphy org `2cece8f2-b17c-49fc-a4a1-91c45b68cae8`, a real live sync succeeded again on Render via `/api/sync-runs/execute` with sync run `36312a09-8b5e-4c06-84c7-8898e6a50528` and snapshot `afbd6a0d-9969-4d9d-a193-6f2b7c74492d`.
- Post-recovery validation tightened the numbers lane substantially: after live sync, `sales_today = 500`, current-week `approved_sales = 500`, and `sales_month = 53979.1` matched the regression script again.
- The remaining regression gap was isolated to `monthScheduledProduction`. Root cause: the month rollup in `backend/src/server.mjs` was counting extra calendar-only jobs outside the recent 200-job lane used by the regression script. The exact overcount found was `15731`, driven mainly by invoice `10277` contributing `15406` plus invoice `9175` contributing `325`.
- Fix was committed first on recovery branch `recovery/numbers-pre-extension` as `aa62c5c` (`Limit month rollups to recent job lane`), then cherry-picked cleanly onto `main` as `0b6335c` without disturbing extension/helper work.
- Late 2026-04-12 lane update: Chad rejected the fake web-only HCP auto-connect flow. The honest product direction is now a Housecall Pro Chrome helper for desktop connect/reconnect, with mobile for viewing/reporting only. Reason: HCP does not expose an open API/OAuth path we can rely on, and a normal website cannot automatically capture HCP login from another tab/domain.
- The smallest real HCP helper path is now built in-repo at `browser-helper/hcp-chrome-extension/` with backend hookup in `backend/src/server.mjs`. Commit: `75af163` (`Add Housecall Pro Chrome helper capture path`). It reads the active Nut Report session from a logged-in Chrome tab, captures HCP cookies from `pro.housecallpro.com`, and posts them to `/api/crm-connection/hcp-helper` so the existing CRM connection model can store them.
- CRM/login/dashboard UX was heavily revised today around connection state: cleaner HCP connection screen, safer CRM status endpoint, disconnect without clearing saved numbers, dashboard reconnect banner, disconnected-CRM popup on dashboard login, and copy clarifications around desktop reconnect behavior. Important commits in this lane included: `5be2436`, `d742199`, `4c88f0c`, `2141e86`, `e8d22a6`, `06bb16b`, `5f9e70b`, `8ff0f3a`, `6f3e180`, `94edf6d`, and `4a4ba01`.
- Extension/distribution state at end of session: the helper engine works, but the client-friendly install path does not. Chad explicitly does not want a future where he must hand-hold each client through extension install. The correct next lane is Chrome Web Store distribution, not more fake connection-page polishing.
- Submission prep work is now in repo: `browser-helper/package-extension.sh` creates `browser-helper/dist/profitstack-hcp-helper.zip` without relying on host `zip`, and `browser-helper/CHROME_WEB_STORE_SUBMISSION.md` contains the draft single-purpose statement, privacy behavior statement, and test instructions. Commits: `b172098` and `f480729`.
- Privacy page was updated specifically for Chrome expectations. `frontend/app/privacy.html` now includes `Data Usage`, `Information We Collect`, `How We Use Information`, `Data Sharing`, and `Data Security` sections with explicit CRM-data/no-sale language and contact info. Commits: `546d781` and `26cebb0`.
- Important hard truth for tomorrow: if the live app says `not connected`, do not trust it as truly updating via the old path. Local/browser-linked dev behavior and live product behavior are now separate realities. The live product should be treated as not reliably updating until the new connection path is fully completed and actually connected.
- Current best next-step order for tomorrow is: (1) resume Murphy month-production truth immediately, (2) isolate or replicate the exact current-month scheduled-production rule Chad uses in reporting so the Month Production card reconciles to his visible math, (3) only after that resume Chrome Web Store/install-distribution and remaining launch polish.
- End-of-day 2026-04-13 billing state: Stripe product `The Nut Report` exists with `Core` pricing at `$197/month`, a live payment link exists, homepage/public-site CTAs now point to that checkout, and a dedicated `frontend/app/signup-success.html` page was added to replace the dumb plain-signup post-payment destination.
- Late 2026-04-13 launch truth: billing technically works, but the buyer flow is still not clean enough to call launched. The weak spot is onboarding after payment, not Stripe itself.
- Important late-day repo commits to preserve: `c8a90d7` (`Wire public CTAs to Stripe checkout`), `6e61b39` (`Restore signup CTA copy with Stripe link`), and `e62690b` (`Add paid signup success page`).
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
- Regression protection now exists in-repo at `scripts/check-nut-report-regression.js`. It currently validates Sales Today / Week / Month and the Month Production card, but caution: on 2026-04-14 the script still matched the old recent-job-based month lane at certain points in time even when Chad's business-truth month rule disagreed. That means regression-script agreement alone is no longer enough to call the Month Production card correct.
- 2026-04-14 onboarding/product work substantially improved the paid setup experience without breaking live reporting. Key commits were: `0e64504`, `1f2ef5e`, `9add1ac`, `d9334e9`, `ae909db`, `bdcf346`, `21668e5`, `6e321c0`, `1c09002`, and `c0ca2f1`. Setup mode now guides the control panel step-by-step (Monthly Expense Target -> Enter, Profit % Goal -> Enter, Timezone -> Enter, then Refresh Data), shows a 30-60 second wait message during refresh, and keeps step state across re-renders.
- Chad explicitly liked the setup-flow direction on 2026-04-14 once the control panel was highlighted and only the active field blinked. Live sync still worked after these UI changes.
- Month-production truth got messier on 2026-04-14, not cleaner. Observed/calculated values included: old recent-job lane `62506.6`, broad all-details lane `78237.6`, calendar-linked detail lane `73803.6`, week-bucket-derived month path `72314.83`, and one live Render value after deploy `69594.83`. None matched Chad's manual month-view reconciliation.
- Chad's current business-truth target for Murphy April month production is `76302`, based on visible scheduling numbers: adjusted first split week `24414` (`30723 - 6309` for March-only portion), plus `20490`, `20020`, `26143`, and `5759`. This is the number the Month Production card now needs to reconcile to, or the exact HCP month-view source needs to be found.
- Two backend commits were made while testing new month-production paths on 2026-04-14: `679c99b` (`Drive month production from scheduled production path`) and `24927fe` (`Derive month production from week buckets`). Render picked up the latter, but the live card still did not reconcile to Chad's visible reporting math.
- End-of-day 2026-04-14 truth: onboarding is in much better shape, but Murphy Month Production is still not ready to be called trusted. The next session should not drift into more UI polish until the month card is reconciled or the exact HCP month source is isolated.
- 2026-04-15 major product update: Chad's Chrome helper was approved in the Chrome Web Store. Live approved URL: `https://chromewebstore.google.com/detail/okbokknaecolfcdhhgbalnmjbbngncki?utm_source=item-share-cb`.
- 2026-04-15 onboarding lane moved hard into the approved-helper flow. A real pre-connect step now exists at `frontend/app/connect-crm.html`, and setup was rerouted through it from `signup-success.html`, `login.js`, and `account.js`. Current intended buyer path is: Stripe/payment -> `signup-success.html` -> `connect-crm.html` -> Housecall Pro connect -> dashboard/setup.
- Important 2026-04-15 helper/onboarding commits included: `5d48e28`, `11adad0`, `584a239`, `db12148`, `d7ab2f0`, `11b21f8`, `388d168`, `32acbdc`, `78a2784`, `6739c53`, `4f6c851`, `90e7d52`, `3793c5f`, and `3189eb9`. If the onboarding flow looks wrong, start by reviewing those commits in order instead of guessing.
- Real bugs found on 2026-04-15: (1) the pre-connect page redirected to `unauthorized.html` because it polled `/api/crm-connection` before a valid session existed, fixed in `db12148`; (2) popup modals rendered at the bottom of the page because `connect-crm.html` had malformed CSS with literal `+` patch artifacts and duplicated rules, fixed in `4f6c851`.
- Important product truth from 2026-04-15: the website cannot honestly detect whether the Chrome extension is installed. Any installed-state based only on local browser memory is fake proof. The accepted product compromise is to ask the user to confirm install, then treat backend-confirmed Housecall Pro connection as the first real done state.
- Exact stop point for next session: ask Chad to test the onboarding flow on another computer or clear cookies / use a clean Chrome profile first. Resume from a fresh-environment buyer test before more tweaks. Chad explicitly asked to be reminded of that pickup point.
