# ProfitStack Deploy

See also: `HOSTED_ENV_SELECTION.md`

## Current app shape
- one Node server
- serves frontend app and API on the same port
- health endpoint: `/api/health`

## Local run
```bash
cd /home/outsidethebusinessbox/.openclaw/workspace/profitstack
npm start
```

Then open:
- `http://127.0.0.1:8787/`

## Required env
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `STRIPE_WEBHOOK_SECRET` (if Stripe checkout is enabled)

## Stripe webhook
- Endpoint: `POST {APP_URL}/api/stripe/webhook`
- Events: `checkout.session.completed`
- Configure in Stripe dashboard → Developers → Webhooks → Add endpoint
- Copy the signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`
- On a successful checkout the webhook will:
  - skip provisioning if `metadata.organization_id` already exists, or if the email already has an org
  - otherwise create a new organization, user row, and email a Supabase recovery link so the customer can set a password at `/reset-password.html`

## Docker build
```bash
docker build -t profitstack .
docker run --env-file .env.local -p 8787:8787 profitstack
```

## Health check
- `GET /api/health`

## Notes
- current auth is still an app-shell login, not full Supabase Auth
- backend org scoping already works through resolved user context
- next production step is replacing the login shell with real auth
