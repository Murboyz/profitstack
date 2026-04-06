# ProfitStack Handoff

## Where the project is now
ProfitStack now has live Supabase-backed data for:
- organization
- admin user
- week metrics
- metric overrides
- CRM connection
- sync runs

## Still stubbed
- auth
- tenant enforcement in code
- real multi-org session handling
- real CRM sync engine
- real dashboard writes outside overrides/CRM stub saves

## What should happen next
1. replace remaining fixture-only dashboard pieces
2. add auth and org scoping
3. make frontend stop assuming localhost-only paths
4. prepare hosted deployment target
5. connect the first live tenant fully

## What to avoid next
- more fake expansion that does not help launch
- client-specific branding
- hiding blockers instead of calling them cleanly

## Product rule
ProfitStack is a generic service-business product. Murphy is only the proving account.
