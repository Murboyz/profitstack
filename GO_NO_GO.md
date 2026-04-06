# ProfitStack Go / No-Go

Date: 2026-04-06

## Verdict

**GO for a controlled first-tenant launch.**

**NO-GO for a public or self-serve launch.**

## Why this is a GO for controlled first tenant

The core app is now past the fake-prototype phase:
- dashboard reads live DB-backed data
- overrides read and write
- sync runs read and write
- CRM connection now stores a structured credential envelope
- unauthorized handling exists
- `/api/health` is host-safe
- login shell can resolve known seeded users and tenant scope from the backend

## Why this is still a NO-GO for public rollout

Because ProfitStack still does **not** have:
- real production auth
- public signup
- invite flow
- normal account recovery
- production-grade tenant onboarding

## Ship-now conditions

Ship now only if all of these are true:
- access stays founder-controlled
- users are seeded manually
- this is treated as a proving account rollout
- no one describes the login shell as finished auth
- production env vars are set correctly in the host

## Stop-now conditions

Do not ship yet if any of these are true:
- clients need normal login flows
- clients need self-serve access
- Chad wants broader rollout beyond the first controlled tenant
- production env vars are not ready

## Recommended next move

If Chad wants it live tonight, do the smallest real deployment next:
1. set host env vars
2. deploy the Node app
3. hit `/api/health`
4. log in with the seeded user
5. verify dashboard, CRM, overrides, and sync once in the hosted environment
