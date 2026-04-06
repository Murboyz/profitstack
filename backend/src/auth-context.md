# ProfitStack Auth Context (current step)

This is not full auth yet.

Current implementation step:
- backend resolves a user by email
- backend resolves organization from that user row
- all data reads/writes use that organization_id

Current dev fallback:
- if no header is sent, backend uses `chad@stopworkingbroke.com`

Next auth step later:
- replace this fallback/header flow with real Supabase Auth session handling
- remove any default user fallback in production
