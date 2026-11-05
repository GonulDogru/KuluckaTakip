begin;

create or replace function private.with_sms_signature(p_message text)
returns text language plpgsql immutable set search_path = pg_catalog, pg_temp as $$
declare signature constant text := 'Yalınayak Süs Tavukları 🐔';
  body text := rtrim(coalesce(p_message, ''), E' \n\r\t');
begin
  while right(body, length(signature)) = signature loop
    body := rtrim(left(body, length(body) - length(signature)), E' \n\r\t');
  end loop;
  return case when body = '' then signature else body || E'\n' || signature end;
end;
$$;
revoke all on function private.with_sms_signature(text) from public, anon, authenticated;

create or replace function private.hatch_message(p_batch_id uuid)
returns text language sql stable set search_path = pg_catalog, public, private, pg_temp as $$
  select private.with_sms_signature('Sayın ' || concat_ws(' ', c.first_name, nullif(c.last_name, '-')) || ', '
    || b.egg_count || ' adet ' || lower(translate(e.name, 'IİÇĞÖŞÜ', 'ıiçğöşü'))
    || ' yumurtanızın tahmini çıkım tarihi ' || to_char(b.expected_hatch_date, 'DD.MM.YYYY') || '''dır.')
  from public.batches b join public.customers c on c.id = b.customer_id
  join public.egg_types e on e.id = b.egg_type_id where b.id = p_batch_id;
$$;

create or replace function public.update_sms_message(p_sms_id uuid, p_message text)
returns public.sms_logs language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare s public.sms_logs;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'SMS mesajı boş olamaz.'; end if;
  update public.sms_logs set message = private.with_sms_signature(trim(p_message)), message_is_custom = true,
    needs_review = false, status = case when status = 'QUEUED' then 'PENDING' else status end
  where id = p_sms_id and status in ('PENDING', 'QUEUED', 'FAILED')
    and (lease_until is null or lease_until <= clock_timestamp()) returning * into s;
  if not found then raise exception 'SMS düzenlenebilir durumda değil.'; end if;
  return s;
end;
$$;

create or replace function public.queue_sms(p_sms_id uuid)
returns table(queued boolean, already_queued boolean) language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare s public.sms_logs; b public.batches; c public.customers;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  select b0.* into b from public.batches b0 join public.sms_logs s0 on s0.batch_id = b0.id where s0.id = p_sms_id for update of b0;
  select * into c from public.customers where id = b.customer_id;
  select * into s from public.sms_logs where id = p_sms_id for update;
  if b.id is null or b.expected_hatch_date is null or not c.is_active
      or s.phone is distinct from c.phone_normalized then
    raise exception 'SMS alıcısını ve kuluçka tarihini kontrol edin; müşteri aktif olmalıdır.';
  end if;
  if s.status = 'QUEUED' then return query select false, true; return; end if;
  if s.status <> 'PENDING' then return query select false, false; return; end if;
  -- An explicitly retried older uncertain message may not have received the signature backfill.
  update public.sms_logs set status = 'QUEUED', needs_review = false,
    message = private.with_sms_signature(message) where id = s.id;
  return query select true, false;
end;
$$;

-- Refresh unsent text only. A changed queued message must be reviewed before sending.
update public.sms_logs set message = private.with_sms_signature(message),
  status = case when status = 'QUEUED' then 'PENDING' else status end, needs_review = true
where status in ('PENDING', 'QUEUED', 'FAILED')
  and message is distinct from private.with_sms_signature(message)
  and (lease_until is null or lease_until <= clock_timestamp());

commit;
