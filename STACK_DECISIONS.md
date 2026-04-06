# ProfitStack Stack Decisions

## Recommended stack
- **Frontend hosting:** Vercel
- **Backend runtime:** Node
- **Database/auth:** Supabase
- **Initial app approach:** keep current lightweight app shell, then migrate toward a proper app framework only when needed

## Why
- fastest path to hosted deployment
- lowest friction for auth + database
- enough structure to support multi-tenant rollout
- avoids wasting time overbuilding before first live tenant

## Current rule
Every new implementation decision should reduce distance to:
- hosted frontend
- hosted backend
- real database
- real auth
- real tenant safety
