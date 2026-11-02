begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(7);

insert into auth.users (id, email)
values
  ('60000000-0000-4000-8000-000000000001', 'dashboard-member@example.invalid'),
  ('60000000-0000-4000-8000-000000000002', 'dashboard-outsider@example.invalid')
on conflict (id) do nothing;

insert into public.app_members (user_id, active)
values ('60000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set active = true;

set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

create temporary table dashboard_summary_baseline on commit drop as
select * from public.get_dashboard_summary();

reset role;

insert into public.egg_types (id, name, incubation_days, transfer_day)
values ('61000000-0000-4000-8000-000000000001', 'Dashboard RPC test', 21, 18)
on conflict (id) do nothing;

insert into public.customers (id, first_name, last_name, phone, phone_normalized, is_active)
values
  ('62000000-0000-4000-8000-000000000001', 'Dashboard', 'Active', '05000000001', '+905000000001', true),
  ('62000000-0000-4000-8000-000000000002', 'Dashboard', 'Inactive', '05000000002', '+905000000002', false)
on conflict (id) do nothing;

insert into public.batches (id, batch_no, customer_id, egg_type_id, egg_count, received_date, unit_price)
values (
  '63000000-0000-4000-8000-000000000001',
  'P-TEST-DASHBOARD-001',
  '62000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  12,
  current_date,
  2
)
on conflict (id) do nothing;

insert into public.payments (id, customer_id, batch_id, amount, payment_date)
values (
  '64000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  4.5,
  current_date
)
on conflict (id) do nothing;

set local role authenticated;

select extensions.ok(
  has_function_privilege('authenticated', 'public.get_dashboard_summary()', 'execute'),
  'authenticated users can retrieve the dashboard summary'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.get_dashboard_summary()', 'execute'),
  'anonymous users cannot retrieve the dashboard summary'
);
select extensions.is(
  (select customer_count from public.get_dashboard_summary()),
  (select customer_count + 1 from dashboard_summary_baseline),
  'the summary counts active customers only'
);
select extensions.is(
  (select batch_count from public.get_dashboard_summary()),
  (select batch_count + 1 from dashboard_summary_baseline),
  'the summary counts all batches'
);
select extensions.is(
  (select egg_count from public.get_dashboard_summary()),
  (select egg_count + 12 from dashboard_summary_baseline),
  'the summary includes batch egg counts'
);
select extensions.is(
  (select total_debt from public.get_dashboard_summary()),
  (select total_debt + 19.5 from dashboard_summary_baseline),
  'the summary subtracts payments from batch totals'
);

set local request.jwt.claim.sub = '60000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"60000000-0000-4000-8000-000000000002","role":"authenticated"}';

select extensions.throws_ok(
  $$select * from public.get_dashboard_summary()$$,
  '42501',
  'App access is not authorized.',
  'the summary rejects users without app membership'
);

select * from extensions.finish();
rollback;
