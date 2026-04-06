insert into organizations (
  id,
  name,
  slug,
  timezone,
  status
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Stop Working Broke',
  'stop-working-broke',
  'America/Chicago',
  'active'
)
on conflict (id) do update
set
  name = excluded.name,
  slug = excluded.slug,
  timezone = excluded.timezone,
  status = excluded.status;

insert into users (
  id,
  organization_id,
  email,
  full_name,
  role
)
values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'chad@stopworkingbroke.com',
  'Chad Murray',
  'admin'
)
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role;
