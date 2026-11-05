-- Apply before installing the client that uses the idempotent RPCs.
begin;
create table private.app_requests (
  user_id uuid not null,
  request_id uuid not null,
  action text not null,
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
revoke all on private.app_requests from public, anon, authenticated;

alter table public.payments add column voided_at timestamptz;
alter table public.payments add column void_reason text;
alter table public.payments add column updated_at timestamptz not null default now();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create table private.payment_changes (
  id bigint generated always as identity primary key,
  payment_id uuid not null,
  user_id uuid,
  before_row jsonb,
  after_row jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on private.payment_changes from public, anon, authenticated;

create or replace function public.calculate_batch_dates()
returns trigger language plpgsql set search_path = pg_catalog, public, pg_temp as $$
declare rules record;
begin
  select incubation_days, transfer_day into strict rules from public.egg_types where id = new.egg_type_id;
  if new.unit_price < 0 then raise exception 'Birim fiyat negatif olamaz.'; end if;
  if new.incubation_date is not null and new.incubation_date < new.received_date
      and (tg_op = 'INSERT' or (new.incubation_date, new.received_date) is distinct from (old.incubation_date, old.received_date)) then
    raise exception 'Kuluçka tarihi kabul tarihinden önce olamaz.';
  end if;
  new.transfer_date := new.incubation_date + rules.transfer_day;
  new.expected_hatch_date := new.incubation_date + rules.incubation_days;
  new.total_price := new.egg_count * new.unit_price;
  if new.status in ('RECEIVED', 'INCUBATING') or (new.status = 'TRANSFER_DUE' and (
      new.incubation_date is null or (tg_op = 'UPDATE' and new.incubation_date is distinct from old.incubation_date))) then
    new.status := case when new.incubation_date is null then 'RECEIVED' else 'INCUBATING' end;
  end if;
  if tg_op = 'UPDATE' and new.egg_type_id is distinct from old.egg_type_id
      and new.breed_id is not distinct from old.breed_id then
    new.breed_id := null;
  end if;
  if new.breed_id is not null and not exists (
    select 1 from public.breeds where id = new.breed_id and egg_type_id = new.egg_type_id
  ) then raise exception 'Irk seçilen yumurta türüne ait değil.'; end if;
  if tg_op = 'UPDATE' and new.customer_id is distinct from old.customer_id
      and exists (select 1 from public.payments where batch_id = old.id) then
    raise exception 'Ödemesi bulunan kabulün müşterisi değiştirilemez.';
  end if;
  return new;
end;
$$;

alter table public.sms_logs add column message_is_custom boolean not null default false;
alter table public.sms_logs add column needs_review boolean not null default false;
-- Preserve existing manually written messages; recognize the previous automatic template.
update public.sms_logs set message_is_custom = message !~
  '^Sayın .+, [0-9]+ adet .+ yumurtanızın tahmini çıkım tarihi [0-9]{2}\.[0-9]{2}\.[0-9]{4}''dır\.$';

create or replace function private.hatch_message(p_batch_id uuid)
returns text language sql stable set search_path = pg_catalog, public, pg_temp as $$
  select 'Sayın ' || concat_ws(' ', c.first_name, nullif(c.last_name, '-')) || ', '
    || b.egg_count || ' adet ' || lower(translate(e.name, 'IİÇĞÖŞÜ', 'ıiçğöşü'))
    || ' yumurtanızın tahmini çıkım tarihi ' || to_char(b.expected_hatch_date, 'DD.MM.YYYY') || '''dır.'
  from public.batches b join public.customers c on c.id = b.customer_id
  join public.egg_types e on e.id = b.egg_type_id where b.id = p_batch_id;
$$;

create or replace function private.sync_hatch_sms(p_batch_id uuid, p_create boolean default true)
returns public.sms_logs language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare b public.batches; c public.customers; s public.sms_logs; msg text;
begin
  select * into b from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Yumurta kabulü bulunamadı.'; end if;
  select * into c from public.customers where id = b.customer_id;
  select * into s from public.sms_logs where batch_id = b.id order by created_at, id limit 1 for update;
  if s.status in ('SENDING', 'UNKNOWN') then
    -- Keep the uncertain physical-send history untouched. A later retry must revalidate it.
    return s;
  end if;
  if s.status in ('SENT', 'DELIVERED') then return s; end if;
  msg := private.hatch_message(b.id);
  if s.id is not null then
    update public.sms_logs set customer_id = c.id, phone = c.phone_normalized,
      message = case when message_is_custom or msg is null then message else msg end,
      status = case when status = 'QUEUED' then 'PENDING' else status end,
      needs_review = true
    where id = s.id returning * into s;
  elsif p_create and b.expected_hatch_date is not null and c.is_active then
    insert into public.sms_logs(customer_id, batch_id, phone, message)
    values(c.id, b.id, c.phone_normalized, msg) returning * into s;
  end if;
  return s;
end;
$$;

create or replace function private.sync_batch_sms_trigger()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    perform private.sync_hatch_sms(new.id);
  elsif (new.customer_id, new.egg_type_id, new.egg_count, new.incubation_date, new.expected_hatch_date)
      is distinct from (old.customer_id, old.egg_type_id, old.egg_count, old.incubation_date, old.expected_hatch_date) then
    perform private.sync_hatch_sms(new.id);
  end if;
  return new;
end;
$$;
create trigger batches_sync_sms after insert or update on public.batches
for each row execute function private.sync_batch_sms_trigger();

create or replace function private.sync_customer_sms_trigger()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare b record;
begin
  if (new.phone_normalized, new.first_name, new.last_name, new.is_active)
      is distinct from (old.phone_normalized, old.first_name, old.last_name, old.is_active) then
    for b in select id from public.batches where customer_id = new.id order by id loop
      perform private.sync_hatch_sms(b.id, false);
    end loop;
  end if;
  return new;
end;
$$;
create trigger customers_sync_sms after update on public.customers
for each row execute function private.sync_customer_sms_trigger();

create or replace function public.ensure_hatch_sms(p_batch_id uuid)
returns public.sms_logs language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare s public.sms_logs;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  -- No-op for an existing draft: recovery must never erase custom text or dequeue a valid message.
  perform 1 from public.batches where id = p_batch_id for update;
  select * into s from public.sms_logs where batch_id = p_batch_id order by created_at, id limit 1;
  if s.id is not null then return s; end if;
  return private.sync_hatch_sms(p_batch_id);
end;
$$;

create or replace function public.update_sms_message(p_sms_id uuid, p_message text)
returns public.sms_logs language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare s public.sms_logs;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  if nullif(trim(p_message), '') is null then raise exception 'SMS mesajı boş olamaz.'; end if;
  update public.sms_logs set message = trim(p_message), message_is_custom = true,
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
  -- Consistent lock order: batch, customer lookup, SMS.
  select b0.* into b from public.batches b0 join public.sms_logs s0 on s0.batch_id = b0.id where s0.id = p_sms_id for update of b0;
  select * into c from public.customers where id = b.customer_id;
  select * into s from public.sms_logs where id = p_sms_id for update;
  if b.id is null or b.expected_hatch_date is null or not c.is_active
      or s.phone is distinct from c.phone_normalized then
    raise exception 'SMS alıcısını ve kuluçka tarihini kontrol edin; müşteri aktif olmalıdır.';
  end if;
  if s.status = 'QUEUED' then return query select false, true; return; end if;
  if s.status <> 'PENDING' then return query select false, false; return; end if;
  update public.sms_logs set status = 'QUEUED', needs_review = false where id = s.id;
  return query select true, false;
end;
$$;

-- Preserve the existing lease/token/content protocol, adding current-customer validation.
create or replace function public.claim_sms_for_send(
  p_sms_id uuid, p_device_id uuid, p_device_secret text, p_expected_phone text, p_expected_message text
) returns table(claimed boolean, claim_token uuid, lease_until timestamptz, sms_phone text, sms_message text)
language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
declare b public.batches; c public.customers; s public.sms_logs;
begin
  if not private.is_authorized_app_user() then
    return query select false, null::uuid, null::timestamptz, null::text, null::text; return;
  end if;
  select b0.* into b from public.batches b0 join public.sms_logs s0 on s0.batch_id = b0.id where s0.id = p_sms_id for update of b0;
  select * into c from public.customers where id = b.customer_id;
  update public.sms_logs as log set status = 'SENDING', claimed_by = p_device_id::text,
    claim_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '2 minutes'
  where log.id = p_sms_id and log.status = 'QUEUED' and not log.needs_review
    and log.phone = p_expected_phone and log.message = p_expected_message
    and log.phone = c.phone_normalized and c.is_active and b.expected_hatch_date is not null
    and (log.lease_until is null or log.lease_until <= clock_timestamp()) returning log.* into s;
  return query select s.id is not null, s.claim_token, s.lease_until, s.phone, s.message;
end;
$$;

create or replace function public.resolve_sms_uncertain(p_sms_id uuid, p_resolution text)
returns boolean language plpgsql security definer
set search_path = pg_catalog, public, private, pg_temp as $$
declare s public.sms_logs;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  if p_resolution not in ('sent', 'retry') then raise exception 'Resolution must be sent or retry.'; end if;
  perform 1 from public.batches b join public.sms_logs log on log.batch_id = b.id where log.id = p_sms_id for update of b;
  update public.sms_logs set status = case when p_resolution = 'sent' then 'SENT' else 'PENDING' end,
    claimed_by = null, claim_token = null, lease_until = null,
    provider_response = concat_ws(E'\n', provider_response, 'Kullanıcı tarafından uzlaştırıldı: ' || p_resolution)
  where id = p_sms_id and ((p_resolution = 'sent' and status = 'UNKNOWN') or (p_resolution = 'retry' and status in ('UNKNOWN', 'FAILED')))
    and (lease_until is null or lease_until <= clock_timestamp()) returning * into s;
  if not found then return false; end if;
  if p_resolution = 'retry' and s.batch_id is not null then perform private.sync_hatch_sms(s.batch_id, false); end if;
  return true;
end;
$$;

create or replace function private.validate_payment()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
declare b public.batches; paid numeric;
begin
  select * into strict b from public.batches where id = new.batch_id for update;
  if new.customer_id <> b.customer_id then raise exception 'Ödeme müşterisi yumurta kabulüyle eşleşmiyor.'; end if;
  if tg_op = 'UPDATE' and (new.batch_id, new.customer_id) is distinct from (old.batch_id, old.customer_id) then
    raise exception 'Ödeme başka bir kabule taşınamaz.';
  end if;
  if new.voided_at is null then
    select coalesce(sum(amount), 0) into paid from public.payments where batch_id = b.id and id <> new.id and voided_at is null;
    if paid + new.amount > b.total_price and
        (tg_op = 'INSERT' or new.amount > old.amount or old.voided_at is not null) then
      raise exception 'Ödeme kalan borcu aşamaz.';
    end if;
  end if;
  return new;
end;
$$;
create trigger payments_validate before insert or update on public.payments for each row execute function private.validate_payment();

create or replace function private.audit_payment()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, auth, pg_temp as $$
begin
  insert into private.payment_changes(payment_id, user_id, before_row, after_row)
    values(new.id, auth.uid(), case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end;
$$;
create trigger payments_audit after insert or update on public.payments for each row execute function private.audit_payment();

create or replace function public.save_acceptance(p_request_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, auth, pg_temp as $$
declare prior private.app_requests; c public.customers; b public.batches; breed uuid;
  normalized_phone text; customer_name text; paid numeric; price numeric; result jsonb;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'İşlem kimliği zorunludur.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request_id::text, 0));
  select * into prior from private.app_requests where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if prior.action <> 'acceptance' or prior.input <> p_input then raise exception 'İşlem kimliği farklı bilgilerle kullanılamaz.'; end if;
    return prior.result;
  end if;
  normalized_phone := regexp_replace(p_input->>'phone', '[^0-9]', '', 'g');
  if length(normalized_phone) = 11 and left(normalized_phone, 1) = '0' then normalized_phone := substr(normalized_phone, 2); end if;
  if length(normalized_phone) = 12 and left(normalized_phone, 2) = '90' then normalized_phone := substr(normalized_phone, 3); end if;
  if normalized_phone !~ '^5[0-9]{9}$' or normalized_phone is null then raise exception 'Geçerli bir cep telefonu giriniz.'; end if;
  normalized_phone := '+90' || normalized_phone;
  customer_name := trim(p_input->>'customerName');
  if nullif(customer_name, '') is null then raise exception 'Müşteri adı zorunludur.'; end if;
  paid := coalesce(nullif(replace(p_input->>'paidAmount', ',', '.'), '')::numeric, 0);
  price := replace(p_input->>'unitPrice', ',', '.')::numeric;
  if paid < 0 or price < 0 or paid = 'NaN'::numeric or price = 'NaN'::numeric then raise exception 'Tutar geçersiz.'; end if;
  if not exists (select 1 from public.egg_types where id = (p_input->>'eggTypeId')::uuid and active) then
    raise exception 'Aktif yumurta türü bulunamadı.';
  end if;
  insert into public.customers(first_name, last_name, phone, phone_normalized)
  values(split_part(customer_name, ' ', 1), coalesce(nullif(trim(substr(customer_name, length(split_part(customer_name, ' ', 1)) + 1)), ''), '-'),
    p_input->>'phone', normalized_phone)
  on conflict (phone_normalized) do nothing;
  select * into strict c from public.customers where phone_normalized = normalized_phone for update;
  if not c.is_active then raise exception 'Müşteri arşivlenmiş. Önce müşteri detayından arşivden çıkarın.'; end if;
  if nullif(trim(p_input->>'breed'), '') is not null then
    insert into public.breeds(egg_type_id, name) values((p_input->>'eggTypeId')::uuid, trim(p_input->>'breed'))
      on conflict (egg_type_id, name) do nothing;
    select id into breed from public.breeds where egg_type_id = (p_input->>'eggTypeId')::uuid and name = trim(p_input->>'breed');
  end if;
  insert into public.batches(batch_no, customer_id, egg_type_id, breed_id, egg_count, received_date, incubation_date, unit_price, note)
  values('', c.id, (p_input->>'eggTypeId')::uuid, breed, (p_input->>'eggCount')::integer,
    (p_input->>'receivedDate')::date, nullif(p_input->>'incubationDate', '')::date, price, nullif(trim(p_input->>'note'), '')) returning * into b;
  if paid > 0 then
    insert into public.payments(customer_id, batch_id, amount, payment_date, note)
      values(c.id, b.id, paid, b.received_date, 'Yumurta kabul ödemesi');
  end if;
  result := to_jsonb(b);
  insert into private.app_requests(user_id, request_id, action, input, result) values(auth.uid(), p_request_id, 'acceptance', p_input, result);
  return result;
end;
$$;

create or replace function public.save_payment(p_request_id uuid, p_input jsonb)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, private, auth, pg_temp as $$
declare prior private.app_requests; p public.payments; b public.batches; result jsonb;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'İşlem kimliği zorunludur.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request_id::text, 0));
  select * into prior from private.app_requests where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if prior.action <> 'payment' or prior.input <> p_input then raise exception 'İşlem kimliği farklı bilgilerle kullanılamaz.'; end if;
    return prior.result;
  end if;
  select * into strict b from public.batches where id = (p_input->>'batchId')::uuid for update;
  if p_input->>'customerId' is distinct from b.customer_id::text then raise exception 'Ödeme müşterisi eşleşmiyor.'; end if;
  if nullif(p_input->>'id', '') is null then
    insert into public.payments(customer_id, batch_id, amount, payment_method, payment_date, note)
    values(b.customer_id, b.id, (p_input->>'amount')::numeric, coalesce(p_input->>'paymentMethod', 'Nakit'),
      (p_input->>'paymentDate')::date, p_input->>'note') returning * into p;
  else
    select * into strict p from public.payments where id = (p_input->>'id')::uuid and batch_id = b.id for update;
    if p.voided_at is not null then raise exception 'İptal edilmiş ödeme değiştirilemez.'; end if;
    if p_input->>'expectedUpdatedAt' is distinct from p.updated_at::text
        and (p_input->>'expectedUpdatedAt')::timestamptz is distinct from p.updated_at then
      raise exception 'Ödeme başka bir cihazda değişti. Listeyi yenileyin.';
    end if;
    if coalesce((p_input->>'void')::boolean, false) then
      if nullif(trim(p_input->>'reason'), '') is null then raise exception 'İptal nedeni zorunludur.'; end if;
      update public.payments set voided_at = clock_timestamp(), void_reason = trim(p_input->>'reason') where id = p.id returning * into p;
    else
      update public.payments set amount = (p_input->>'amount')::numeric, payment_date = (p_input->>'paymentDate')::date,
        note = p_input->>'note' where id = p.id returning * into p;
    end if;
  end if;
  result := to_jsonb(p);
  insert into private.app_requests(user_id, request_id, action, input, result) values(auth.uid(), p_request_id, 'payment', p_input, result);
  return result;
end;
$$;

-- Only audited, idempotent payment writes are allowed from the mobile API.
revoke insert, update, delete on public.payments from authenticated;
revoke insert (customer_id, batch_id, phone, message) on public.sms_logs from authenticated;
revoke execute on function public.update_hatch_sms_draft(uuid, uuid, text, text) from authenticated;
revoke all on function public.save_acceptance(uuid, jsonb), public.save_payment(uuid, jsonb), public.ensure_hatch_sms(uuid) from public, anon;
grant execute on function public.save_acceptance(uuid, jsonb), public.save_payment(uuid, jsonb), public.ensure_hatch_sms(uuid) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

create or replace view public.batch_payment_summaries with (security_invoker = true) as
select b.id as batch_id, b.total_price, coalesce(sum(p.amount), 0)::numeric(12,2) as paid_total,
  (b.total_price - coalesce(sum(p.amount), 0))::numeric(12,2) as remaining_debt
from public.batches b left join public.payments p on p.batch_id = b.id and p.voided_at is null group by b.id;

create or replace function public.get_dashboard_summary()
returns table(customer_count bigint, batch_count bigint, egg_count bigint, total_debt numeric)
language plpgsql stable security invoker set search_path = pg_catalog, public, pg_temp as $$
begin
  if not public.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  return query select (select count(*) from public.customers where is_active), count(b.id),
    coalesce(sum(b.egg_count), 0)::bigint, coalesce(sum(b.total_price - coalesce(p.paid, 0)), 0)::numeric
  from public.batches b left join (select batch_id, sum(amount) paid from public.payments where voided_at is null group by batch_id) p on p.batch_id = b.id;
end;
$$;

-- Repair derived dates/status/invalid breed links, and refresh unsent templates including ducks.
-- Existing customer mismatches in historical payments are left for explicit review, not reassigned.
update public.batches set incubation_date = incubation_date
where incubation_date is null or status in ('RECEIVED', 'INCUBATING', 'TRANSFER_DUE');
update public.batches b set breed_id = null where breed_id is not null
  and not exists (select 1 from public.breeds r where r.id = b.breed_id and r.egg_type_id = b.egg_type_id);
do $$ declare b record; begin
  for b in select distinct batch_id from public.sms_logs where batch_id is not null and status in ('PENDING', 'QUEUED', 'FAILED') order by batch_id loop
    perform private.sync_hatch_sms(b.batch_id, false);
  end loop;
end; $$;
commit;
