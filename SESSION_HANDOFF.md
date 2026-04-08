# ProfitStack Session Handoff

## Purpose
Use this file to bootstrap a new dedicated ProfitStack session without losing the old session context.

## Current status
- Estimated completion toward first live pilot shape: **70%**
- Current stage: **Murphy live pilot path working, metric mapping still needs correction**

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
- Do not drift into workspace-root or prototype paths; work in `profitstack/` only.
- After every committed ProfitStack change, immediately give Chad the exact push/deploy step.
- The live Render app now has working login, CRM save, and Refresh wiring.
- Murphy HCP auth is connected, but the metric mapping is still wrong.
- Multi-segment / multi-visit job allocation was introduced as a reporting experiment; if that change breaks trusted production reporting, roll back to the pre-allocation baseline and re-evaluate instead of stacking more patches.
- Long-span single jobs (example: job `10277`, $15,406, Apr 6–Apr 24) now have a separate prorating experiment committed in `549b08f`; if reporting gets worse, come back to this checkpoint before adding more schedule math.
