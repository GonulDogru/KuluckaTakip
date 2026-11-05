-- Standalone assertions, compatible with both local PostgreSQL bootstrap and Supabase.
-- All fixtures are rolled back. Run with psql -v ON_ERROR_STOP=1.
begin;
insert into auth.users(id, email) values('71000000-0000-4000-8000-000000000001', 'flow-member@example.invalid');
insert into public.app_members(user_id) values('71000000-0000-4000-8000-000000000001');
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';
create function pg_temp.check_flow(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end;
$$;
set local role authenticated;
do $$
declare input jsonb; saved jsonb; again jsonb; b uuid; c uuid; e uuid; breed uuid;
  s public.sms_logs; p jsonb; payment_input jsonb; request uuid; total numeric; baseline numeric;
  custom_message text := E'Özel mesaj metni\nYalınayak Süs Tavukları 🐔';
  new_batch jsonb; send_sms public.sms_logs; send_claim record;
begin
  select total_debt into baseline from public.get_dashboard_summary();
  select id into e from public.egg_types where name = 'Tavuk';
  input := jsonb_build_object('phone', '05321234567', 'customerName', 'Akış Test', 'eggTypeId', e,
    'eggCount', '10', 'receivedDate', '2026-11-01', 'incubationDate', '2026-11-02', 'unitPrice', '2,50',
    'paidAmount', '5', 'breed', 'Test ırk', 'note', 'test');
  request := gen_random_uuid();
  saved := public.save_acceptance(request, input); b := (saved->>'id')::uuid; c := (saved->>'customer_id')::uuid;
  perform pg_temp.check_flow((saved->>'total_price')::numeric = 25, 'acceptance calculates total');
  perform pg_temp.check_flow(saved->>'status' = 'INCUBATING', 'dated acceptance enters incubation');
  perform pg_temp.check_flow((select sum(amount) = 5 from public.payments where batch_id = b), 'initial payment saved');
  perform pg_temp.check_flow((select count(*) = 1 from public.sms_logs where batch_id = b), 'one SMS draft created');
  again := public.save_acceptance(request, input);
  perform pg_temp.check_flow(again = saved and (select count(*) = 1 from public.payments where batch_id = b), 'acceptance retry does not duplicate payment or batch');
  begin
    perform public.save_acceptance(request, input || '{"eggCount":"11"}'::jsonb);
    raise exception 'FAIL: changed request payload accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(sqlerrm like 'İşlem kimliği%', 'idempotency rejects changed payload');
  end;
  begin
    perform public.save_acceptance(gen_random_uuid(), input || '{"phone":"05321234568","paidAmount":"26"}'::jsonb);
    raise exception 'FAIL: excessive payment accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(not exists(select 1 from public.customers where phone_normalized = '+905321234568'), 'invalid initial payment rolls back customer, batch and SMS');
  end;
  select * into s from public.sms_logs where batch_id = b;
  perform public.queue_sms(s.id);
  update public.batches set note = 'yalnız not' where id = b;
  perform pg_temp.check_flow((select status = 'QUEUED' from public.sms_logs where id = s.id), 'note-only update preserves queued SMS');
  perform public.update_sms_message(s.id, custom_message);
  update public.batches set egg_count = 11 where id = b;
  perform pg_temp.check_flow((select message = custom_message and status = 'PENDING' and needs_review from public.sms_logs where id = s.id), 'custom message preserved and changes require review');
  perform public.queue_sms(s.id);
  update public.customers set phone = '05321234569', phone_normalized = '+905321234569' where id = c;
  perform pg_temp.check_flow((select phone = '+905321234569' and status = 'PENDING' from public.sms_logs where id = s.id), 'customer phone change refreshes recipient and dequeues SMS');
  perform public.queue_sms(s.id);
  update public.batches set incubation_date = null where id = b;
  perform pg_temp.check_flow((select expected_hatch_date is null and transfer_date is null and status = 'RECEIVED' from public.batches where id = b), 'removing date clears derived dates and received state');
  begin
    perform public.queue_sms(s.id); raise exception 'FAIL: undated SMS queued';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'undated SMS cannot be queued');
  end;
  update public.batches set incubation_date = '2026-11-03' where id = b;
  perform pg_temp.check_flow((select status = 'INCUBATING' and expected_hatch_date = '2026-11-24' from public.batches where id = b), 'adding date synchronizes status and date');
  perform public.queue_sms(s.id);
  perform pg_temp.check_flow(not (select claimed from public.claim_sms_for_send(s.id, gen_random_uuid(), 'unused', '+905321234567', custom_message)), 'stale confirmed recipient cannot claim');
  perform pg_temp.check_flow((select claimed from public.claim_sms_for_send(s.id, gen_random_uuid(), 'unused', '+905321234569', custom_message)), 'current confirmed content claims once');
  perform pg_temp.check_flow(not (select claimed from public.claim_sms_for_send(s.id, gen_random_uuid(), 'unused', '+905321234569', custom_message)), 'second device cannot claim the same SMS');
  update public.customers set phone_normalized = '+905321234570', phone = '05321234570' where id = c;
  perform pg_temp.check_flow((select status = 'SENDING' and phone = '+905321234569' from public.sms_logs where id = s.id), 'in-flight send history is preserved');
  -- Test FAILED/UNKNOWN recovery separately below with privileged fixtures after this block.
  select id into breed from public.breeds where egg_type_id = e and name = 'Test ırk';
  select id into e from public.egg_types where name = 'Ördek';
  update public.batches set egg_type_id = e where id = b;
  perform pg_temp.check_flow((select breed_id is null from public.batches where id = b), 'changing egg type clears old breed');
  begin
    update public.batches set breed_id = breed where id = b;
    raise exception 'FAIL: cross-type breed accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'cross-type breed rejected');
  end;
  payment_input := jsonb_build_object('batchId', b, 'customerId', c, 'amount', 10, 'paymentDate', '2026-11-05', 'paymentMethod', 'Nakit', 'note', null);
  request := gen_random_uuid(); p := public.save_payment(request, payment_input);
  perform pg_temp.check_flow(public.save_payment(request, payment_input) = p, 'payment retry returns same payment');
  perform pg_temp.check_flow((select sum(amount) = 15 from public.payments where batch_id = b and voided_at is null), 'payment retry does not double amount');
  begin
    perform public.save_payment(gen_random_uuid(), payment_input || '{"amount":1000}'::jsonb);
    raise exception 'FAIL: excessive payment accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'excessive payment rejected');
  end;
  begin
    perform public.save_payment(gen_random_uuid(), payment_input || jsonb_build_object('customerId', gen_random_uuid()));
    raise exception 'FAIL: incorrect customer accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'payment customer mismatch rejected');
  end;
  payment_input := payment_input || jsonb_build_object('id', p->>'id', 'expectedUpdatedAt', p->>'updated_at', 'amount', 7);
  p := public.save_payment(gen_random_uuid(), payment_input);
  perform pg_temp.check_flow((p->>'amount')::numeric = 7, 'payment amount correction succeeds');
  begin
    perform public.save_payment(gen_random_uuid(), payment_input || '{"expectedUpdatedAt":"2000-01-01T00:00:00Z"}'::jsonb);
    raise exception 'FAIL: stale edit accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'stale payment edit rejected');
  end;
  payment_input := payment_input || jsonb_build_object('expectedUpdatedAt', p->>'updated_at', 'void', true, 'reason', 'Yanlış tutar');
  request := gen_random_uuid(); p := public.save_payment(request, payment_input);
  perform pg_temp.check_flow(p->>'voided_at' is not null and public.save_payment(request, payment_input) = p, 'void keeps history and is idempotent');
  perform pg_temp.check_flow((select paid_total = 5 from public.batch_payment_summaries where batch_id = b), 'voided payment excluded from debt view');
  select total_debt into total from public.get_dashboard_summary();
  perform pg_temp.check_flow(total - baseline = 22.5, 'dashboard excludes voided payment');
  perform pg_temp.check_flow(not has_table_privilege('authenticated', 'public.payments', 'INSERT') and not has_table_privilege('authenticated', 'public.payments', 'UPDATE') and not has_table_privilege('authenticated', 'public.payments', 'DELETE'), 'direct unaudited payment writes blocked');
  perform pg_temp.check_flow(not has_function_privilege('anon', 'public.save_payment(uuid,jsonb)', 'execute'), 'anonymous financial RPC blocked');
  update public.customers set is_active = false where id = c;
  begin
    perform public.save_acceptance(gen_random_uuid(), input || '{"phone":"05321234570"}'::jsonb);
    raise exception 'FAIL: archived customer accepted';
  exception when raise_exception then
    if sqlerrm like 'FAIL:%' then raise; end if;
    perform pg_temp.check_flow(true, 'archived customer must be restored explicitly');
  end;
  update public.customers set is_active = true where id = c;
  new_batch := public.save_acceptance(gen_random_uuid(), input || '{"phone":"05321234570"}'::jsonb);
  perform pg_temp.check_flow(new_batch->>'customer_id' = c::text, 'restored customer reused without duplication');
  perform pg_temp.check_flow((public.ensure_hatch_sms(b)).id = s.id, 'draft recovery does not create a second SMS');
  select * into send_sms from public.sms_logs where batch_id = (new_batch->>'id')::uuid;
  perform public.queue_sms(send_sms.id);
  select * into send_claim from public.claim_sms_for_send(send_sms.id, '75000000-0000-4000-8000-000000000001', 'unused', send_sms.phone, send_sms.message);
  perform pg_temp.check_flow(public.renew_sms_claim(send_sms.id, '75000000-0000-4000-8000-000000000001', 'unused', send_claim.claim_token), 'claim lease can still be renewed');
  perform pg_temp.check_flow(not public.mark_sms_sent(send_sms.id, '75000000-0000-4000-8000-000000000001', 'unused', gen_random_uuid(), 'test'), 'wrong claim token cannot finalize a send');
  perform pg_temp.check_flow(public.mark_sms_failed(send_sms.id, '75000000-0000-4000-8000-000000000001', 'unused', send_claim.claim_token, 'test failure'), 'valid claim records definite failure');
  perform pg_temp.check_flow(not (select claimed from public.claim_sms_for_send(send_sms.id, gen_random_uuid(), 'unused', send_sms.phone, send_sms.message)), 'failed SMS cannot be silently retried');
  perform public.resolve_sms_uncertain(send_sms.id, 'retry');
  perform public.queue_sms(send_sms.id);
  select * into send_claim from public.claim_sms_for_send(send_sms.id, '75000000-0000-4000-8000-000000000002', 'unused', send_sms.phone, send_sms.message);
  perform pg_temp.check_flow(public.mark_sms_sent(send_sms.id, '75000000-0000-4000-8000-000000000002', 'unused', send_claim.claim_token, 'test accepted'), 'explicit retry can finish with a valid token');
  update public.customers set first_name = 'Yeni ad' where id = c;
  perform pg_temp.check_flow((select status = 'SENT' and message = send_sms.message from public.sms_logs where id = send_sms.id), 'sent message history remains immutable after customer edit');
  update public.batches set status = 'TRANSFER_DUE' where id = (new_batch->>'id')::uuid;
  update public.batches set note = 'not değişikliği' where id = (new_batch->>'id')::uuid;
  perform pg_temp.check_flow((select status = 'TRANSFER_DUE' from public.batches where id = (new_batch->>'id')::uuid), 'note-only edit preserves transfer state');
end;
$$;
reset role;
update public.sms_logs set status = 'UNKNOWN', lease_until = null where status = 'SENDING';
set local role authenticated;
do $$ declare s public.sms_logs; begin
  select * into s from public.sms_logs where status = 'UNKNOWN' and customer_id in (select id from public.customers where phone_normalized = '+905321234570') limit 1;
  perform pg_temp.check_flow(public.resolve_sms_uncertain(s.id, 'retry'), 'uncertain send can be explicitly retried');
  perform pg_temp.check_flow((select status = 'PENDING' and phone = '+905321234570' and needs_review from public.sms_logs where id = s.id), 'retry refreshes stale recipient and requires a new queue confirmation');
end; $$;
reset role;
select pg_temp.check_flow((select count(*) >= 4 from private.payment_changes where user_id = '71000000-0000-4000-8000-000000000001'), 'payment additions, corrections and voids leave audit history');
set local request.jwt.claim.sub = '71000000-0000-4000-8000-000000000099';
set local role authenticated;
do $$ begin
  begin
    perform public.save_acceptance(gen_random_uuid(), '{}'::jsonb);
    raise exception 'FAIL: unauthorized account accepted';
  exception when insufficient_privilege then
    perform pg_temp.check_flow(true, 'non-member RPC rejected');
  end;
end; $$;
rollback;
