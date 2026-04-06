# ProfitStack Backend Data Model

## Goal
Make ProfitStack tenant-safe and generic for any service business.

## Core entities

### organizations
Represents a client account.

Fields:
- id
- name
- slug
- timezone
- status
- created_at
- updated_at

### users
Users who belong to organizations.

Fields:
- id
- organization_id
- email
- full_name
- role
- created_at
- updated_at

### crm_connections
Stores the CRM connection for an organization.

Fields:
- id
- organization_id
- provider
- status
- auth_type
- encrypted_credentials
- last_sync_at
- last_error
- created_at
- updated_at

### sync_runs
Tracks every sync attempt.

Fields:
- id
- organization_id
- crm_connection_id
- started_at
- finished_at
- status
- records_pulled
- error_message
- raw_snapshot_path

### week_metrics
Stores normalized week-level output for the dashboard.

Fields:
- id
- organization_id
- week_start_date
- week_end_date
- scheduled_production
- approved_sales
- completed_production
- opportunities
- source_confidence
- source_version
- created_at
- updated_at

### metric_overrides
Stores trusted manual overrides separately from auto-pulled values.

Fields:
- id
- organization_id
- week_start_date
- metric_key
- metric_value
- reason
- created_by_user_id
- created_at
- updated_at

## Rules
- every row is scoped to an organization
- auto-pulled data and manual overrides stay separate
- final dashboard values come from merged output, not raw source rows
- CRM-specific logic belongs in connection/sync layers, not frontend
- week logic must stay Mon-Sun

## First backend outputs
- merged current week metrics
- merged last week metrics
- merged next 3 weeks metrics
- sync status
- override status
