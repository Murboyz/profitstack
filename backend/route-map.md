# ProfitStack Backend Route Map

## Core routes
- `GET /api/dashboard`
- `GET /api/crm-connection`
- `POST /api/crm-connection`
- `GET /api/overrides`
- `POST /api/overrides`
- `GET /api/sync-runs`
- `POST /api/sync-runs`
- `POST /api/sync-runs/execute`

## Future routes
- `GET /api/organizations/me`
- `GET /api/users/me`
- `POST /api/auth/login`
- `POST /api/auth/logout`

## Route responsibilities
### /api/dashboard
Returns merged, frontend-ready metrics for the logged-in org.

### /api/crm-connection
Handles provider connection state and setup.

### /api/overrides
Reads and writes trusted manual metric overrides.

### /api/sync-runs
Shows sync history for debugging and trust, and stores new sync run records.

### /api/sync-runs/execute
Stores a raw CRM snapshot, normalizes weekly metrics, writes `week_metrics`, and records the sync run.

## Rule
Frontend consumes backend-ready responses. Business-critical calculations stay server-side.
