create table if not exists crm_snapshots (
  id uuid primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  crm_connection_id uuid references crm_connections(id) on delete set null,
  provider text not null,
  source_label text,
  payload jsonb not null,
  captured_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_snapshots_org_created_at
  on crm_snapshots(organization_id, created_at desc);

alter table crm_snapshots enable row level security;

drop policy if exists crm_snapshots_same_org on crm_snapshots;
create policy crm_snapshots_same_org
  on crm_snapshots
  for all
  using (
    exists (
      select 1
      from users u
      where u.organization_id = crm_snapshots.organization_id
        and u.auth_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from users u
      where u.organization_id = crm_snapshots.organization_id
        and u.auth_user_id = auth.uid()
    )
  );
