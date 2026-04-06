# ProfitStack Deploy Tonight

## Goal
Push ProfitStack as a controlled first-tenant launch without inventing more architecture.

## Deployment shape
- one hosted Node service
- port `8787`
- same app serves frontend + API
- one Supabase project behind it

## Before deploy

### 1) Set host env vars
Copy these from local/Supabase into the host:
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `HOUSECALL_PRO_CLIENT_ID`
- `HOUSECALL_PRO_CLIENT_SECRET`
- `ENCRYPTION_KEY`
- `CRON_SECRET`

### 2) Confirm runtime
- start command: `npm start`
- app port: `8787`
- health endpoint: `/api/health`

### 3) Confirm launch mode
This is a **controlled first-tenant launch**, not public signup.
See `FIRST_TENANT_LAUNCH_DECISION.md`.

## Deploy sequence
1. deploy the current repo state
2. wait for app boot
3. hit `/api/health`
4. open `/login.html`
5. sign in with the seeded user
6. verify dashboard
7. verify CRM page
8. verify overrides save
9. verify sync run save

## Hosted smoke test
Run:
```bash
bash profitstack/scripts/hosted-smoke-test.sh https://your-profitstack-domain.com chad@stopworkingbroke.com
```

## Ship / stop rule

### Ship if:
- `/api/health` returns 200
- login page loads
- seeded user resolves
- dashboard loads
- CRM page loads
- overrides save
- sync runs save

### Stop if:
- env vars are missing
- `/api/health` fails
- seeded user cannot resolve
- Supabase-backed routes fail

## Important constraint
Do not present this as public multi-tenant product auth yet.
It is ready for a controlled first-tenant rollout only.
