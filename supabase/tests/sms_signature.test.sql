begin;
insert into auth.users(id, email) values('78000000-0000-4000-8000-000000000001', 'signature-test@example.invalid');
insert into public.app_members(user_id) values('78000000-0000-4000-8000-000000000001');
set local request.jwt.claim.sub = '78000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare b jsonb; s public.sms_logs; updated public.sms_logs; claim record;
  signature constant text := 'Yalınayak Süs Tavukları 🐔';
begin
  b := public.save_acceptance(gen_random_uuid(), jsonb_build_object(
    'customerName', 'İmza Test', 'phone', '05321114455', 'eggTypeId', (select id from public.egg_types where name = 'Tavuk'),
    'eggCount', '10', 'receivedDate', '2026-11-05', 'incubationDate', '2026-11-05', 'unitPrice', '2', 'paidAmount', '0'));
  select * into strict s from public.sms_logs where batch_id = (b->>'id')::uuid;
  if right(s.message, length(signature) + 1) is distinct from E'\n' || signature then raise exception 'FAIL: generated SMS signature'; end if;
  raise notice 'PASS: generated SMS ends with the signature on its own line';
  updated := public.update_sms_message(s.id, 'Özel mesaj');
  if updated.message <> E'Özel mesaj\n' || signature then raise exception 'FAIL: custom SMS signature'; end if;
  raise notice 'PASS: custom SMS receives the same signature';
  updated := public.update_sms_message(s.id, updated.message);
  if updated.message <> E'Özel mesaj\n' || signature then raise exception 'FAIL: duplicate signature'; end if;
  raise notice 'PASS: resaving does not duplicate the signature';
  updated := public.update_sms_message(s.id, updated.message || E'\n' || signature || E'\n ');
  if updated.message <> E'Özel mesaj\n' || signature then raise exception 'FAIL: repeated signatures'; end if;
  raise notice 'PASS: repeated trailing signatures normalize to one';
  perform public.queue_sms(s.id);
  select * into claim from public.claim_sms_for_send(s.id, '79000000-0000-4000-8000-000000000001', 'unused', s.phone, updated.message);
  if not claim.claimed or claim.sms_message <> updated.message then raise exception 'FAIL: signed content claim'; end if;
  raise notice 'PASS: confirmed-content claim uses the entire signed message';
  if not public.mark_sms_sent(s.id, '79000000-0000-4000-8000-000000000001', 'unused', claim.claim_token, 'test only') then raise exception 'FAIL: send finalization'; end if;
  update public.customers set first_name = 'Yeni ad' where id = (b->>'customer_id')::uuid;
  if not exists(select 1 from public.sms_logs where id = s.id and status = 'SENT' and message = updated.message) then raise exception 'FAIL: sent history changed'; end if;
  raise notice 'PASS: sent signed message history is preserved';
end;
$$;
rollback;
