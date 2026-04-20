# ProfitStack

ProfitStack is a generic operating dashboard web app for service businesses.

Murphy is only the first proving account. It is **not** the product identity.

## What exists right now

### Product direction
- generic service-business positioning
- current dashboard shape defined
- backend data model defined
- backend API contract defined
- tenant/auth flow defined
- CRM sync flow defined
- Supabase schema direction defined

### Frontend
- dashboard shell page
- page map
- stub frontend pages
- dashboard payload wired to a shared contract-shaped mock

### Backend
- route map
- route stubs
- service stubs
- shared dashboard payload shape mirrored in backend mock route

### Data layer
- schema doc
- first migration stub
- env template

## What is stubbed
- auth
- organization scoping enforcement in code
- real database wiring
- real API handlers
- real CRM connection flow
- real sync engine
- real override persistence
- real deployment config

## What gets built next
1. real frontend app shell
2. real backend route handlers
3. real database wiring
4. real dashboard endpoint
5. real override endpoint
6. CRM connection implementation
7. sync implementation
8. deployment setup

## Guardrails
- generic product, not a Murphy custom dashboard
- keep auto-pulled data separate from manual overrides
- week logic is Monday through Sunday
- suppress untrusted sales data rather than fake precision
- frontend consumes backend-ready metrics instead of inventing its own math

## Key directories
- `frontend/` - app UI and page stubs
- `backend/` - route, service, and architecture files
- `shared/` - shared contract types
- `supabase/` - schema and migration direction
test edit
