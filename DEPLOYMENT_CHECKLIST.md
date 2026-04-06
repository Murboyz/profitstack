# ProfitStack Deployment Checklist

## App foundation
- [ ] choose framework/runtime defaults
- [ ] wire frontend app shell
- [ ] wire backend route handlers
- [ ] add environment config

## Data
- [ ] create Supabase project
- [ ] apply initial schema
- [ ] add row-level security
- [ ] seed a test organization

## Product plumbing
- [ ] connect dashboard endpoint
- [ ] connect overrides endpoint
- [ ] connect CRM status endpoint
- [ ] create sync-run logging

## Launch readiness
- [ ] set production env vars
- [ ] verify auth and tenant isolation
- [ ] verify Mon-Sun week logic
- [ ] verify override precedence
