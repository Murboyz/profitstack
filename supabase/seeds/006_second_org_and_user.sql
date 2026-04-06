insert into organizations (
  id,
  name,
  slug,
  timezone,
  status
)
values (
  '33333333-3333-3333-3333-333333333333',
  'Northfield Service Co',
  'northfield-service-co',
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
  '44444444-4444-4444-4444-444444444444',
  '33333333-3333-3333-3333-333333333333',
  'owner@northfieldserviceco.com',
  'Northfield Owner',
  'admin'
)
on conflict (id) do update
set
  organization_id = excluded.organization_id,
  email = excluded.email,
  full_name = excluded.full_name,
  role = excluded.role;
