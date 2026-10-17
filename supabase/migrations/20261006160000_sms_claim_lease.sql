create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.sms_logs
  add column if not exists claimed_by text,
  add column if not exists claim_token uuid,
  add column if not exists lease_until timestamptz;

create table if not exists public.sms_sender_devices (
  device_id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  active boolean not null default true,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists sms_sender_devices_single_primary_idx
  on public.sms_sender_devices (is_primary)
  where active and is_primary;

alter table public.sms_sender_devices enable row level security;
revoke all on public.sms_sender_devices from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_primary_sms_device(
  p_device_id uuid,
  p_device_secret text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.sms_sender_devices as device
    where device.device_id = p_device_id
      and device.active
      and device.is_primary
      and device.secret_hash = encode(extensions.digest(convert_to(p_device_secret, 'UTF8'), 'sha256'), 'hex')
  );
$$;

revoke all on function private.is_primary_sms_device(uuid, text) from public, anon, authenticated;

alter table public.sms_logs enable row level security;
revoke all on public.sms_logs from public, anon, authenticated;
grant select on public.sms_logs to anon, authenticated;
grant insert (customer_id, batch_id, phone, message) on public.sms_logs to anon, authenticated;

drop policy if exists sms_logs_app_select on public.sms_logs;
create policy sms_logs_app_select
  on public.sms_logs
  for select
  to anon, authenticated
  using (true);

drop policy if exists sms_logs_app_insert on public.sms_logs;
create policy sms_logs_app_insert
  on public.sms_logs
  for insert
  to anon, authenticated
  with check (true);

create or replace function public.update_hatch_sms_draft(
  p_sms_id uuid,
  p_customer_id uuid,
  p_phone text,
  p_message text
)
returns public.sms_logs
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  updated_sms public.sms_logs;
begin
  update public.sms_logs as sms
  set customer_id = p_customer_id,
      phone = p_phone,
      message = p_message,
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status in ('PENDING', 'QUEUED')
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp())
  returning sms.* into updated_sms;

  if not found then
    raise exception 'SMS draft is unavailable or currently claimed.';
  end if;

  return updated_sms;
end;
$$;

create or replace function public.update_sms_message(
  p_sms_id uuid,
  p_message text
)
returns public.sms_logs
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  updated_sms public.sms_logs;
begin
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'SMS message cannot be empty.';
  end if;

  update public.sms_logs as sms
  set message = trim(p_message),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status in ('PENDING', 'QUEUED')
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp())
  returning sms.* into updated_sms;

  if not found then
    raise exception 'SMS is unavailable or currently claimed.';
  end if;

  return updated_sms;
end;
$$;

create or replace function public.queue_sms(p_sms_id uuid)
returns table (queued boolean, already_queued boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
begin
  update public.sms_logs as sms
  set status = 'QUEUED'
  where sms.id = p_sms_id
    and sms.status = 'PENDING'
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp());

  if found then
    return query select true, false;
    return;
  end if;

  return query
  select false, exists (
    select 1 from public.sms_logs as sms
    where sms.id = p_sms_id and sms.status = 'QUEUED'
  );
end;
$$;

create or replace function public.claim_sms(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text
)
returns table (
  claimed boolean,
  claim_token uuid,
  lease_until timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
declare
  new_claim_token uuid;
  new_lease_until timestamptz;
begin
  if not private.is_primary_sms_device(p_device_id, p_device_secret) then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;

  update public.sms_logs as sms
  set claimed_by = p_device_id::text,
      claim_token = gen_random_uuid(),
      lease_until = clock_timestamp() + interval '5 minutes'
  where sms.id = p_sms_id
    and sms.status = 'QUEUED'
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp())
  returning sms.claim_token, sms.lease_until
  into new_claim_token, new_lease_until;

  if found then
    return query select true, new_claim_token, new_lease_until;
  else
    return query select false, null::uuid, null::timestamptz;
  end if;
end;
$$;

create or replace function public.release_sms_claim(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
begin
  if not private.is_primary_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'QUEUED'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
end;
$$;

create or replace function public.mark_sms_sent(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_claim_token uuid,
  p_provider_response text default null
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
begin
  if not private.is_primary_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set status = 'SENT',
      provider_response = p_provider_response,
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'QUEUED'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
end;
$$;

create or replace function public.mark_sms_failed(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_claim_token uuid,
  p_error text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, pg_temp
as $$
begin
  if not private.is_primary_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set provider_response = left(coalesce(nullif(trim(p_error), ''), 'SMS sending failed.'), 2000),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'QUEUED'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
end;
$$;

revoke all on function public.update_hatch_sms_draft(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_sms_message(uuid, text) from public, anon, authenticated;
revoke all on function public.queue_sms(uuid) from public, anon, authenticated;
revoke all on function public.claim_sms(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_sms_claim(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_sms_sent(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_sms_failed(uuid, uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.update_hatch_sms_draft(uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.update_sms_message(uuid, text) to anon, authenticated;
grant execute on function public.queue_sms(uuid) to anon, authenticated;
grant execute on function public.claim_sms(uuid, uuid, text) to anon, authenticated;
grant execute on function public.release_sms_claim(uuid, uuid, text, uuid) to anon, authenticated;
grant execute on function public.mark_sms_sent(uuid, uuid, text, uuid, text) to anon, authenticated;
grant execute on function public.mark_sms_failed(uuid, uuid, text, uuid, text) to anon, authenticated;
