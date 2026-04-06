insert into crm_connections (
  id,
  organization_id,
  provider,
  status,
  auth_type,
  encrypted_credentials,
  last_sync_at,
  last_error
)
values (
  '50000000-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'housecall_pro',
  'connected',
  'session_or_oauth',
  '{"mode":"stub-seeded"}'::jsonb,
  now(),
  null
)
on conflict (id) do update
set
  provider = excluded.provider,
  status = excluded.status,
  auth_type = excluded.auth_type,
  encrypted_credentials = excluded.encrypted_credentials,
  last_sync_at = excluded.last_sync_at,
  last_error = excluded.last_error,
  updated_at = now();
