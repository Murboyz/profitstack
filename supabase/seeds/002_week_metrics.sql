insert into week_metrics (
  id,
  organization_id,
  week_start_date,
  week_end_date,
  scheduled_production,
  approved_sales,
  completed_production,
  opportunities,
  source_confidence,
  source_version
)
values
  ('30000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-03-23', '2026-03-29', 30640.50, 8385.80, null, null, 'seed', 'v1'),
  ('30000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026-03-30', '2026-04-05', 29228.00, 0.00, null, null, 'seed', 'v1'),
  ('30000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '2026-04-06', '2026-04-12', 31280.00, null, null, null, 'seed', 'v1'),
  ('30000000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '2026-04-13', '2026-04-19', 8483.10, null, null, null, 'seed', 'v1'),
  ('30000000-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', '2026-04-20', '2026-04-26', 4550.50, null, null, null, 'seed', 'v1')
on conflict (id) do update
set
  scheduled_production = excluded.scheduled_production,
  approved_sales = excluded.approved_sales,
  completed_production = excluded.completed_production,
  opportunities = excluded.opportunities,
  source_confidence = excluded.source_confidence,
  source_version = excluded.source_version,
  updated_at = now();
