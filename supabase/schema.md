# ProfitStack Supabase Schema

## Goal
Translate the backend data model into a clean persistence plan for Supabase/Postgres.

## Tables

### organizations
```sql
create table organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  timezone text not null default 'America/Chicago',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### users
```sql
create table users (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### crm_connections
```sql
create table crm_connections (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  provider text not null,
  status text not null default 'pending',
  auth_type text,
  encrypted_credentials jsonb,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### sync_runs
```sql
create table sync_runs (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  crm_connection_id uuid references crm_connections(id) on delete set null,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  records_pulled integer,
  error_message text,
  raw_snapshot_path text
);
```

### week_metrics
```sql
create table week_metrics (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  week_start_date date not null,
  week_end_date date not null,
  scheduled_production numeric(12,2),
  approved_sales numeric(12,2),
  completed_production numeric(12,2),
  opportunities integer,
  source_confidence text,
  source_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### metric_overrides
```sql
create table metric_overrides (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  week_start_date date not null,
  metric_key text not null,
  metric_value numeric(12,2) not null,
  reason text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Indexes
```sql
create index idx_users_org on users(organization_id);
create index idx_crm_connections_org on crm_connections(organization_id);
create index idx_sync_runs_org on sync_runs(organization_id, started_at desc);
create index idx_week_metrics_org_week on week_metrics(organization_id, week_start_date);
create index idx_metric_overrides_org_week on metric_overrides(organization_id, week_start_date);
```

## Constraints
- one org can have many users
- one org can have one or more crm connections over time
- week metrics are org-scoped
- overrides are org-scoped and week-scoped
- all frontend-visible values must resolve through organization scope

## Notes
- use row-level security for tenant isolation
- keep raw source payloads outside frontend-facing tables
- merge `week_metrics` + `metric_overrides` in backend responses
