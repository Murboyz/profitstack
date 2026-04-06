insert into sync_runs (
  id,
  organization_id,
  crm_connection_id,
  started_at,
  finished_at,
  status,
  records_pulled,
  error_message,
  raw_snapshot_path
)
values (
  '60000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '50000000-0000-0000-0000-000000000001',
  now() - interval '5 minutes',
  now() - interval '4 minutes',
  'success',
  5,
  null,
  'seed://sync-run-1'
)
on conflict (id) do update
set
  started_at = excluded.started_at,
  finished_at = excluded.finished_at,
  status = excluded.status,
  records_pulled = excluded.records_pulled,
  error_message = excluded.error_message,
  raw_snapshot_path = excluded.raw_snapshot_path;
