# ProfitStack Production Launch Path

## Goal
Get ProfitStack live without bloating the stub app further.

## Phase 1: deployment setup
- create production repo/repo settings
- create Supabase project
- create Vercel project or equivalent frontend host
- set environment variables
- define production domains/subdomains

## Phase 2: persistence and auth
- apply first migration
- wire real auth
- wire tenant/org scoping
- create seed org and admin user

## Phase 3: replace fake data path
- replace shared JSON fixture with database reads
- replace CRM write stub with real persistence
- replace override write stub with real persistence
- expose dashboard from DB-backed route

## Phase 4: first live tenant
- load first organization
- verify login
- verify current week dashboard
- verify overrides
- verify sync history visibility

## Guardrails
- do not keep expanding fake pages unless they support launch
- every new step should move toward hosted, persistent, tenant-safe operation
- Murphy remains a proving account, not the product identity
