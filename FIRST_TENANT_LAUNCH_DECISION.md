# ProfitStack First-Tenant Launch Decision

## Decision

**Yes, ProfitStack can launch for a controlled first tenant with the current shell login.**

But only under this rule:
- founder-controlled access
- no public signup
- no client self-serve onboarding
- only known seeded users already present in the database

## What this means

Allowed now:
- internal use
- founder-led demos
- one proving account
- controlled operator access

Not allowed yet:
- public launch
- open client login distribution
- multi-tenant self-serve rollout
- claiming production-grade auth is complete

## Why this is acceptable for v1

Because the current app already:
- resolves the user from the backend database
- resolves organization scope server-side
- rejects unknown users
- scopes reads and writes to the resolved organization
- now has unauthorized handling instead of raw errors

## Why this is not full production auth

Because it still does **not** provide:
- real identity provider login
- passwordless login flow
- password auth
- invite flow
- normal account recovery
- production auth assurance

## Launch rule

If ProfitStack goes live before real auth is added, it must be described as:
- **controlled first-tenant launch**
- **operator-managed access**
- **not public signup ready**

## Go / no-go

### Go now if:
- Chad is willing to keep access controlled
- the first tenant is treated as a proving account
- no one pretends the login shell is finished auth

### No-go if:
- the app needs public client access now
- the app needs normal production auth now
- the app needs broader tenant rollout now

## Recommended next step after launch

Replace the shell login with real auth before expanding beyond the first controlled tenant.
