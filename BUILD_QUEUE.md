# ProfitStack Build Queue

Process exactly one unchecked item per autonomous run.
After completion:
- update this file
- commit changes
- stop

## Active Queue
- [x] Replace remaining fixture-backed dashboard fields with live DB-backed sources
- [x] Add real sync-runs write path instead of seed-only history
- [x] Add real CRM credential storage shape beyond stub JSON marker
- [x] Add frontend session banner showing current user/org clearly
- [x] Add route-level unauthorized handling UI beyond raw error text
- [x] Add basic hosted env selection docs for production vs local
- [x] Add first production deploy dry-run checklist pass

## Stop Conditions
Stop immediately if:
- auth/security design needs founder judgment
- external credentials are missing
- a step would risk destructive data changes
- the next task is ambiguous
- the next task would require broad product direction choices
