-- Codifies the organization_settings table the backend has been writing to via
-- /rest/v1/organization_settings. Adding this migration so dev environments
-- can recreate the schema and so RLS is consistent with crm_snapshots.

create table if not exists organization_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  monthly_expense_target numeric(14,2),
  profit_percent_goal numeric(6,2),
  opportunity_count integer,
  sales_today numeric(14,2),
  sales_month numeric(14,2),
  sales_year numeric(14,2),
  updated_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_settings_updated_at
  on organization_settings(updated_at desc);

alter table organization_settings enable row level security;

drop policy if exists organization_settings_same_org on organization_settings;
create policy organization_settings_same_org
  on organization_settings
  for all
  using (
    exists (
      select 1
      from users u
      where u.organization_id = organization_settings.organization_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from users u
      where u.organization_id = organization_settings.organization_id
        and u.auth_user_id = auth.uid()
    )
  );
