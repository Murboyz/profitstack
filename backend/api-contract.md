# ProfitStack Backend API Contract

## Goal
Define the contract between the ProfitStack frontend and backend before implementation drifts.

## Base shape
All endpoints are organization-scoped and return tenant-safe data.

## Endpoints

### GET /api/dashboard
Returns the merged dashboard payload for the logged-in organization.

Response shape:
```json
{
  "organization": {
    "id": "org_123",
    "name": "Example Service Co"
  },
  "crmConnection": {
    "provider": "housecall_pro",
    "status": "connected",
    "lastSyncAt": "2026-04-05T22:00:00Z",
    "lastError": null
  },
  "weeks": {
    "lastWeek": {
      "range": "Mar 23–Mar 29, 2026",
      "scheduledProduction": 30640.5,
      "approvedSales": 8385.8
    },
    "currentWeek": {
      "range": "Mar 30–Apr 5, 2026",
      "scheduledProduction": 29228,
      "approvedSales": 0
    },
    "nextWeek": {
      "range": "Apr 6–Apr 12, 2026",
      "scheduledProduction": 31280
    },
    "weekPlus2": {
      "range": "Apr 13–Apr 19, 2026",
      "scheduledProduction": 8483.1
    },
    "weekPlus3": {
      "range": "Apr 20–Apr 26, 2026",
      "scheduledProduction": 4550.5
    }
  },
  "overridesApplied": {
    "lastWeek": {
      "scheduledProduction": true,
      "approvedSales": true
    },
    "currentWeek": {
      "scheduledProduction": true
    }
  }
}
```

### GET /api/crm-connection
Returns CRM connection state for the org.

Response shape:
```json
{
  "provider": "housecall_pro",
  "status": "connected",
  "authType": "session_or_oauth",
  "lastSyncAt": "2026-04-05T22:00:00Z",
  "lastError": null
}
```

### POST /api/crm-connection
Creates or updates the CRM connection for the org.

Request shape:
```json
{
  "provider": "housecall_pro",
  "authPayload": {}
}
```

### GET /api/overrides
Returns active overrides for the org.

Response shape:
```json
{
  "items": [
    {
      "weekStartDate": "2026-03-30",
      "metricKey": "scheduledProduction",
      "metricValue": 29228,
      "reason": "trusted verified value"
    }
  ]
}
```

### POST /api/overrides
Creates or updates an override.

Request shape:
```json
{
  "weekStartDate": "2026-03-30",
  "metricKey": "scheduledProduction",
  "metricValue": 29228,
  "reason": "trusted verified value"
}
```

### GET /api/sync-runs
Returns recent sync history for the org.

Response shape:
```json
{
  "items": [
    {
      "startedAt": "2026-04-05T21:45:00Z",
      "finishedAt": "2026-04-05T21:46:12Z",
      "status": "success",
      "recordsPulled": 65,
      "errorMessage": null
    }
  ]
}
```

### POST /api/sync-runs/execute
Stores a raw snapshot, normalizes it into weekly metrics, writes `week_metrics`, and records a sync run.

Request shape:
```json
{
  "sourceLabel": "manual sync snapshot",
  "snapshot": {
    "weeks": [
      {
        "weekStartDate": "2026-03-30",
        "weekEndDate": "2026-04-05",
        "scheduledProduction": 29228,
        "approvedSales": 8385.8,
        "completedProduction": 0,
        "opportunities": 8
      }
    ]
  }
}
```

## Rules
- merged dashboard response is the main frontend payload
- frontend should not compute business-critical metrics on its own
- overrides are explicit and inspectable
- CRM connection state is separate from dashboard metrics
- sync history is visible for trust and debugging
