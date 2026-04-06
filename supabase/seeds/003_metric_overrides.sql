insert into metric_overrides (
  id,
  organization_id,
  week_start_date,
  metric_key,
  metric_value,
  reason,
  created_by_user_id
)
values
  ('40000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2026-03-23', 'scheduledProduction', 30640.50, 'trusted seeded value', '22222222-2222-2222-2222-222222222222'),
  ('40000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2026-03-23', 'approvedSales', 8385.80, 'trusted seeded value', '22222222-2222-2222-2222-222222222222'),
  ('40000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '2026-03-30', 'scheduledProduction', 29228.00, 'trusted seeded value', '22222222-2222-2222-2222-222222222222')
on conflict (organization_id, week_start_date, metric_key) do update
set
  metric_value = excluded.metric_value,
  reason = excluded.reason,
  created_by_user_id = excluded.created_by_user_id,
  updated_at = now();
