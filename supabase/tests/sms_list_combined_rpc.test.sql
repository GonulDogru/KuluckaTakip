begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(5);

insert into auth.users (id, email)
values
  ('40000000-0000-4000-8000-000000000001', 'sms-list-member@example.invalid'),
  ('40000000-0000-4000-8000-000000000002', 'sms-list-outsider@example.invalid')
on conflict (id) do nothing;

insert into public.app_members (user_id, active)
values ('40000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set active = true;

insert into public.sms_logs (id, phone, message, status, claimed_by, lease_until)
values (
  '50000000-0000-4000-8000-000000000001',
  '+905551234567',
  'expired claim test',
  'SENDING',
  'expired-device',
  clock_timestamp() - interval '1 second'
);

select extensions.ok(
  has_function_privilege('authenticated', 'public.list_sms_logs_with_expired_claims()', 'execute'),
  'authenticated users can list SMS logs through the combined RPC'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.list_sms_logs_with_expired_claims()', 'execute'),
  'anonymous users cannot list SMS logs through the combined RPC'
);

set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"40000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select extensions.is(
  (
    select count(*)::integer
    from public.list_sms_logs_with_expired_claims()
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  1,
  'the combined RPC returns SMS rows'
);
select extensions.is(
  (
    select status
    from public.list_sms_logs_with_expired_claims()
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'UNKNOWN',
  'the combined RPC expires stale claims before returning rows'
);

set local request.jwt.claim.sub = '40000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"40000000-0000-4000-8000-000000000002","role":"authenticated"}';

select extensions.throws_ok(
  $$select * from public.list_sms_logs_with_expired_claims()$$,
  '42501',
  'App access is not authorized.',
  'the combined RPC rejects users without app membership'
);

select * from extensions.finish();
rollback;
