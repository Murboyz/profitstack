# ProfitStack Production Dry Run

Date: 2026-04-06

## Goal
Do a first reality-based pass on whether ProfitStack can be pushed toward a hosted production deploy without guessing.

## Result
**Status: NOT READY FOR PRODUCTION YET**

This dry run was still useful because it separated real progress from real blockers.

## What was verified

### App surface
- PASS — `http://127.0.0.1:8787/login.html` returns 200
- PASS — `http://127.0.0.1:8787/unauthorized.html` returns 200
- PASS — `http://127.0.0.1:8787/ops.html` returns 200

### Auth-scoped API routes
Verified with seeded user header `X-User-Email: chad@stopworkingbroke.com`.

- PASS — `/api/session` returns 200
- PASS — `/api/dashboard` returns 200
- PASS — `/api/crm-connection` returns 200
- PASS — `/api/overrides` returns 200
- PASS — `/api/sync-runs` returns 200

### Current product plumbing state
- PASS — dashboard payload now resolves live DB-backed data instead of leaning on fixture fields
- PASS — unauthorized route handling exists instead of raw error text only
- PASS — hosted environment choice is documented in `HOSTED_ENV_SELECTION.md`

## Blockers found in the dry run

### 1) Health check is now publicly usable
- RESOLVED — `/api/health` now returns 200 without an authenticated user header
- Detail: tenant-aware diagnostics moved to `/api/health/session`

### 2) Sync history is read-only from seeded data
- BLOCKED — sync runs can be read, but the real write path is still a remaining build item
- Why it matters: production sync visibility is incomplete until live runs can be recorded

### 3) CRM credential storage is still a stub
- BLOCKED — CRM connection persistence still uses a stub credential marker rather than a real storage shape
- Why it matters: production CRM connection setup is not trustworthy yet

### 4) Auth is still app-shell login, not real production auth
- BLOCKED — login is still driven by stored email selection rather than a production-grade auth flow
- Why it matters: tenant safety and real hosted access are not done yet

## Important note on app startup
A fresh `npm start` attempt failed only because port `8787` was already in use, which strongly suggests the app was already running locally during the dry run. That is not itself a product blocker.

## Fastest path from here
1. finish real sync-run write path
2. define or cut CRM credential storage for v1
3. make `/api/health` host-safe
4. decide whether the current login shell is acceptable for a controlled first tenant or must be replaced before deploy

## Bottom line
ProfitStack is no longer in fake-dashboard territory.
But it is **not** yet ready for a real production deploy because sync writes, CRM credential storage, health check shape, and real auth are still unresolved.
