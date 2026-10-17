begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(36);

insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'sms-member@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'sms-outsider@example.invalid')
on conflict (id) do nothing;

insert into public.app_members (user_id, active)
values ('10000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do update set active = true;

insert into public.sms_sender_devices (device_id, secret_hash, active, is_primary)
values
  ('20000000-0000-4000-8000-000000000001', encode(extensions.digest(convert_to('test-device-a', 'UTF8'), 'sha256'), 'hex'), true, false),
  ('20000000-0000-4000-8000-000000000002', encode(extensions.digest(convert_to('test-device-b', 'UTF8'), 'sha256'), 'hex'), true, false)
on conflict (device_id) do update
set secret_hash = excluded.secret_hash,
    active = excluded.active,
    is_primary = false;

insert into public.sms_logs (id, phone, message, status)
values
  ('30000000-0000-4000-8000-000000000001', '+15550000001', 'test claim', 'QUEUED'),
  ('30000000-0000-4000-8000-000000000002', '+15550000002', 'test sent', 'QUEUED'),
  ('30000000-0000-4000-8000-000000000003', '+15550000003', 'test failed', 'QUEUED'),
  ('30000000-0000-4000-8000-000000000004', '+905551234567', 'confirmed test message', 'QUEUED'),
  ('30000000-0000-4000-8000-000000000005', '+15550000005', 'unregistered device test', 'QUEUED'),
  ('30000000-0000-4000-8000-000000000006', '+15550000006', 'preserve this queued record', 'QUEUED');

create temporary table sms_test_claims (
  sms_id uuid primary key,
  claim_token uuid not null,
  sms_phone text,
  sms_message text
);
grant select, insert, update, delete on sms_test_claims to authenticated;

select extensions.ok(
  not has_table_privilege('anon', 'public.sms_logs', 'select'),
  'anon cannot read SMS records'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.sms_logs', 'insert'),
  'anon cannot insert SMS records'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.sms_logs', 'update'),
  'app clients cannot directly change SMS status or claim columns'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.claim_sms(uuid,uuid,text)', 'execute'),
  'anon cannot execute the legacy SMS claim RPC'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'public.claim_sms(uuid,uuid,text)', 'execute'),
  'authenticated cannot execute the legacy SMS claim RPC'
);
select extensions.ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) as acl
    where p.oid = 'public.claim_sms(uuid,uuid,text)'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no EXECUTE grant on the legacy SMS claim RPC'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.claim_sms_for_send(uuid,uuid,text,text,text)', 'execute'),
  'authenticated can execute the confirmed-content SMS claim RPC'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.claim_sms_for_send(uuid,uuid,text,text,text)', 'execute'),
  'anon cannot claim a confirmed SMS'
);

set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;

select extensions.throws_ok(
  $$select * from public.claim_sms(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a'
  )$$,
  '42501',
  'permission denied for function claim_sms',
  'authenticated cannot invoke the legacy SMS claim RPC'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    '+905551234567',
    'changed after confirmation'
  )),
  false,
  'a changed message cannot be claimed for sending'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    '+905559999999',
    'confirmed test message'
  )),
  false,
  'a changed recipient cannot be claimed for sending'
);
select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000004'),
  'QUEUED',
  'a mismatched confirmation leaves the SMS queued'
);
with claim as (
  select * from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000099',
    'unregistered-device',
    '+905551234567',
    'confirmed test message'
  )
)
insert into sms_test_claims (sms_id, claim_token, sms_phone, sms_message)
select '30000000-0000-4000-8000-000000000004', claim_token, sms_phone, sms_message
from claim
where claimed;
select extensions.ok(
  (select claim_token is not null from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000004'),
  'an exact confirmation atomically claims the SMS'
);
select extensions.is(
  (select sms_phone || '|' || sms_message from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000004'),
  '+905551234567|confirmed test message',
  'the claim returns the exact recipient and message shown for confirmation'
);

with claim as (
  select * from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    '+15550000001',
    'test claim'
  )
)
insert into sms_test_claims (sms_id, claim_token)
select '30000000-0000-4000-8000-000000000001', claim_token
from claim
where claimed;

select extensions.is(
  (select claim_token is not null from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000001'),
  true,
  'an active app member receives a claim token'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'test-device-b',
    '+15550000001',
    'test claim'
  )),
  false,
  'a second device cannot claim a message with a live lease'
);
select extensions.is(
  public.renew_sms_claim(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    (select claim_token from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000001')
  ),
  true,
  'the current claimant can renew its live lease'
);
select extensions.is(
  public.mark_sms_sent(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    gen_random_uuid(),
    null
  ),
  false,
  'a mismatched claim token cannot mark SMS sent'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000097',
    'unregistered-device-a',
    '+15550000003',
    'test failed'
  )),
  true,
  'an active app member can send from a device without a device registration'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000098',
    'unregistered-device-b',
    '+15550000005',
    'unregistered device test'
  )),
  true,
  'a second unregistered device is also allowed for an active app member'
);

reset role;
update public.sms_logs
set lease_until = clock_timestamp() - interval '1 second'
where id = '30000000-0000-4000-8000-000000000001';
set local role authenticated;

select extensions.is(public.expire_sms_claims(), 1, 'an expired sending lease is converted to an uncertain result');
select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000001'),
  'UNKNOWN',
  'an expired lease is not silently returned to the queue'
);
select extensions.is(
  public.mark_sms_sent(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    (select claim_token from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000001'),
    null
  ),
  false,
  'an expired claim token cannot mark SMS sent'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'test-device-b',
    '+15550000001',
    'test claim'
  )),
  false,
  'another device cannot automatically reclaim an uncertain SMS'
);
select extensions.is(
  public.resolve_sms_uncertain('30000000-0000-4000-8000-000000000001', 'retry'),
  true,
  'an authorized user can explicitly approve a retry'
);

with claim as (
  select * from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'test-device-b',
    '+15550000001',
    'test claim'
  )
)
insert into sms_test_claims (sms_id, claim_token)
select '30000000-0000-4000-8000-000000000001', claim_token
from claim
where claimed
on conflict (sms_id) do update set claim_token = excluded.claim_token;

select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000001'),
  'SENDING',
  'an explicit retry must be claimed again before sending'
);
select extensions.is(
  public.mark_sms_sent(
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000002',
    'test-device-b',
    (select claim_token from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000001'),
    'test callback'
  ),
  true,
  'the current valid claim can mark an accepted SMS sent'
);
select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000001'),
  'SENT',
  'successful status update is terminal'
);

with claim as (
  select * from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    '+15550000002',
    'test sent'
  )
)
insert into sms_test_claims (sms_id, claim_token)
select '30000000-0000-4000-8000-000000000002', claim_token
from claim
where claimed
on conflict (sms_id) do update set claim_token = excluded.claim_token;

select extensions.is(
  public.mark_sms_failed(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'test-device-a',
    (select claim_token from sms_test_claims where sms_id = '30000000-0000-4000-8000-000000000002'),
    'test failure'
  ),
  true,
  'the current valid claim can record a definite send failure'
);
select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000002'),
  'FAILED',
  'a failed result is not automatically re-queued'
);
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'test-device-b',
    '+15550000002',
    'test sent'
  )),
  false,
  'a failed SMS cannot be automatically claimed again'
);

reset role;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;

select extensions.is(public.is_authorized_app_user(), false, 'a signed-in but unapproved user is not an app member');
select extensions.is((select count(*)::integer from public.sms_logs), 0, 'an unapproved user cannot read SMS records');
select extensions.is(
  (select claimed from public.claim_sms_for_send(
    '30000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000099',
    'unapproved-device',
    '+15550000006',
    'preserve this queued record'
  )),
  false,
  'an unapproved user cannot claim an SMS for sending'
);
reset role;
select extensions.is(
  (select status from public.sms_logs where id = '30000000-0000-4000-8000-000000000006'),
  'QUEUED',
  'a denied claim leaves its SMS queued'
);

select extensions.is(
  (select status || '|' || phone || '|' || message from public.sms_logs where id = '30000000-0000-4000-8000-000000000006'),
  'QUEUED|+15550000006|preserve this queued record',
  'an unrelated queued SMS record remains unchanged'
);

select * from extensions.finish();
rollback;
