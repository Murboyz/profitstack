# ProfitStack Hosted Environment Selection

## One recommendation

Use **one hosted Node service + one Supabase project** for v1.

That means:
- **local** → run the Node app directly with `.env.local`
- **production** → deploy the same Node app as a single hosted web service
- **database/auth/secrets** → keep in Supabase + host environment variables

Do **not** split frontend and backend hosting for v1.
The app already serves both on one port. Splitting it now adds drag and buys nothing.

## Local vs production

### Local
Use this for build and debugging.

Run:
```bash
cd /home/outsidethebusinessbox/.openclaw/workspace/profitstack
npm start
```

Open:
- `http://127.0.0.1:8787/`

Env source:
- `.env.local`

### Production
Use this for the first live tenant.

Run the same app shape:
- one Node web service
- port `8787`
- same routes for frontend + API
- env injected by the host

Back it with:
- one production Supabase project

## Recommended production shape

### App host
Pick any host that can run a long-lived Node service with environment variables.

V1 requirement checklist:
- deploy from git
- persistent env var management
- custom domain support
- restart on deploy
- health check support

### Database/auth host
Use Supabase for:
- Postgres
- service role access
- anon key
- future auth migration

## Required production env vars

From `.env.example`:
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `HOUSECALL_PRO_CLIENT_ID`
- `HOUSECALL_PRO_CLIENT_SECRET`
- `ENCRYPTION_KEY`
- `CRON_SECRET`

## What belongs where

### Local-only file
- `.env.local`

### Production host env
- all real production secrets
- any host-level app config

### Supabase
- database data
- tenant records
- future auth records

## V1 launch rule

For the first live version, choose the environment that lets ProfitStack behave exactly like local with the fewest moving parts:
- one app service
- one Supabase project
- one domain
- no frontend/backend split
- no separate worker unless sync work truly forces it later

## What not to do yet

Do not add for v1:
- separate frontend hosting
- separate API gateway
- multi-environment matrix beyond local + production
- background worker infrastructure before sync volume requires it
- Kubernetes / Docker swarm / fancy orchestration nonsense

## Decision

**Default v1 deployment target:** single hosted Node app + Supabase.

If hosting choice is still open, pick the option with the fastest git deploy and env management, not the prettiest architecture diagram.
