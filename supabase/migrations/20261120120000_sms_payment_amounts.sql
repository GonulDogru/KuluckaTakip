begin;
create or replace function private.hatch_message(p_batch_id uuid)
returns text language sql stable set search_path = pg_catalog, public, private, pg_temp as $$
  select private.with_sms_signature('Sayın ' || concat_ws(' ', c.first_name, nullif(c.last_name, '-')) || ', '
    || b.egg_count || ' adet ' || lower(translate(e.name, 'IİÇĞÖŞÜ', 'ıiçğöşü'))
    || ' yumurtanızın tahmini çıkım tarihi ' || to_char(b.expected_hatch_date, 'DD.MM.YYYY') || '''dır.'
    || ' Ödenen ücret: ' || replace(to_char(coalesce(p.paid, 0), 'FM999999999990.00'), '.', ',') || ' TL.'
    || ' Kalan ödeme: ' || replace(to_char(greatest(0, b.total_price - coalesce(p.paid, 0)), 'FM999999999990.00'), '.', ',') || ' TL.')
  from public.batches b join public.customers c on c.id = b.customer_id
  join public.egg_types e on e.id = b.egg_type_id
  left join lateral (select sum(amount) paid from public.payments where batch_id = b.id and voided_at is null) p on true
  where b.id = p_batch_id;
$$;
create or replace function private.sync_payment_sms_trigger()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.batch_id is distinct from new.batch_id then
    perform private.sync_hatch_sms(old.batch_id, false);
  end if;
  if tg_op = 'INSERT' or (old.amount, old.voided_at, old.batch_id) is distinct from (new.amount, new.voided_at, new.batch_id) then
    perform private.sync_hatch_sms(new.batch_id, false);
  end if;
  return new;
end;
$$;
create trigger payments_sync_sms after insert or update on public.payments
for each row execute function private.sync_payment_sms_trigger();
create or replace function private.sync_price_sms_trigger()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
begin
  if new.unit_price is distinct from old.unit_price then
    perform private.sync_hatch_sms(new.id, false);
  end if;
  return new;
end;
$$;
create trigger batches_price_sync_sms after update of unit_price on public.batches
for each row execute function private.sync_price_sms_trigger();
do $$
declare item record;
begin
  for item in select distinct batch_id from public.sms_logs
    where batch_id is not null and status in ('PENDING', 'QUEUED', 'FAILED') and not message_is_custom
  loop
    perform private.sync_hatch_sms(item.batch_id, false);
  end loop;
end;
$$;
commit;
