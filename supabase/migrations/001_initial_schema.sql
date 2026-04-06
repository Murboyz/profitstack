-- ProfitStack initial schema stub
-- Prep this for production migrations and row-level security later.

create table if not exists organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  timezone text not null default 'America/Chicago',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, email)
);

create table if not exists crm_connections (
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

create table if not exists sync_runs (
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

create table if not exists week_metrics (
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
  updated_at timestamptz not null default now(),
  unique (organization_id, week_start_date)
);

create table if not exists metric_overrides (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  week_start_date date not null,
  metric_key text not null,
  metric_value numeric(12,2) not null,
  reason text,
  created_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, week_start_date, metric_key)
);

create index if not exists idx_users_org on users(organization_id);
create index if not exists idx_crm_connections_org on crm_connections(organization_id);
create index if not exists idx_sync_runs_org_started on sync_runs(organization_id, started_at desc);
create index if not exists idx_week_metrics_org_week on week_metrics(organization_id, week_start_date);
create index if not exists idx_metric_overrides_org_week on metric_overrides(organization_id, week_start_date);

-- RLS prep notes:
-- alter table organizations enable row level security;
-- alter table users enable row level security;
-- alter table crm_connections enable row level security;
-- alter table sync_runs enable row level security;
-- alter table week_metrics enable row level security;
-- alter table metric_overrides enable row level security;
