# Deployment Plan

## Goal
Ship ProfitStack as a hosted product, not a local prototype.

## Phase 1
- recreate current dashboard UI in real app frontend
- add login shell
- add CRM connection shell
- add override UI

## Phase 2
- port week-metrics pipeline into backend
- persist source pulls
- persist overrides separately
- expose merged metrics API to frontend

## Phase 3
- deploy on Vercel + Supabase
- add scheduled syncs
- add error logging and admin visibility

## Blockers before go-live
- stable sales logic
- reliable HCP connection strategy
- tenant-safe auth model
- production deployment config
