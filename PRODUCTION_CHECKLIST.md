# ProfitStack Production Checklist

See also: `PRODUCTION_DRY_RUN.md`

## Hosting
- [ ] choose frontend host
- [ ] choose backend host if separate
- [ ] set production domain
- [ ] set preview/staging domain

## Supabase
- [ ] create project
- [ ] store project URL
- [ ] store anon key
- [ ] store service role key
- [ ] apply initial schema

## Auth + tenancy
- [ ] enable auth provider(s)
- [ ] create org-aware user model
- [ ] enforce org scope server-side
- [ ] add row-level security

## Backend
- [ ] replace fixture route with DB-backed route
- [ ] persist crm connections
- [ ] persist overrides
- [ ] persist sync runs

## Frontend
- [ ] point app to hosted backend
- [ ] remove hardcoded localhost URLs
- [ ] add login gate
- [ ] show org-specific data only

## Launch check
- [ ] dashboard loads for seeded org
- [ ] CRM page loads
- [ ] overrides page loads and saves
- [ ] sync page loads
- [ ] account page loads
