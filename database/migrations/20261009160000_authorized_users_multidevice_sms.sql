create table if not exists public.app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.app_members enable row level security;
revoke all on public.app_members from public, anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.is_authorized_app_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.app_members as member
      where member.user_id = auth.uid()
        and member.active
    );
$$;

revoke all on function private.is_authorized_app_user() from public, anon, authenticated;

create or replace function public.is_authorized_app_user()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
  select private.is_authorized_app_user();
$$;

revoke all on function public.is_authorized_app_user() from public, anon, authenticated;
grant execute on function public.is_authorized_app_user() to authenticated;

create or replace function private.is_registered_sms_device(
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
      and device.secret_hash = encode(
        extensions.digest(convert_to(p_device_secret, 'UTF8'), 'sha256'),
        'hex'
      )
  );
$$;

revoke all on function private.is_registered_sms_device(uuid, text) from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers',
    'egg_types',
    'breeds',
    'machines',
    'racks',
    'batches',
    'placements',
    'hatch_baskets',
    'hatch_basket_placements',
    'payments',
    'hatch_results',
    'sms_logs',
    'placement_cells',
    'rack_trays',
    'tray_allocations'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    if table_name = 'sms_logs' then
      execute 'revoke update, delete on public.sms_logs from authenticated';
      execute 'grant select, insert (customer_id, batch_id, phone, message) on public.sms_logs to authenticated';
    else
      execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    end if;
    execute format('drop policy if exists app_member_access on public.%I', table_name);
    execute format('drop policy if exists app_member_gate on public.%I', table_name);
    execute format(
      'create policy app_member_access on public.%I for all to authenticated using (public.is_authorized_app_user()) with check (public.is_authorized_app_user())',
      table_name
    );
    execute format(
      'create policy app_member_gate on public.%I as restrictive for all to authenticated using (public.is_authorized_app_user()) with check (public.is_authorized_app_user())',
      table_name
    );
  end loop;
end;
$$;

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
drop policy if exists profiles_owner_access on public.profiles;
drop policy if exists profiles_owner_gate on public.profiles;
create policy profiles_owner_access
  on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
create policy profiles_owner_gate
  on public.profiles
  as restrictive
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke all on public.batch_payment_summaries from public, anon, authenticated;
grant select on public.batch_payment_summaries to authenticated;
alter view public.batch_payment_summaries set (security_invoker = true);

revoke all on all sequences in schema public from public, anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.update_hatch_sms_draft(
  p_sms_id uuid,
  p_customer_id uuid,
  p_phone text,
  p_message text
)
returns public.sms_logs
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
declare
  updated_sms public.sms_logs;
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;

  update public.sms_logs as sms
  set customer_id = p_customer_id,
      phone = p_phone,
      message = p_message,
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status in ('PENDING', 'QUEUED', 'FAILED')
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
declare
  updated_sms public.sms_logs;
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;
  if p_message is null or length(trim(p_message)) = 0 then
    raise exception 'SMS message cannot be empty.';
  end if;

  update public.sms_logs as sms
  set message = trim(p_message),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status in ('PENDING', 'QUEUED', 'FAILED')
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;

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

create or replace function public.expire_sms_claims()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
declare
  expired_count integer;
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;

  update public.sms_logs as sms
  set status = 'UNKNOWN',
      provider_response = left(
        concat_ws(E'\n', nullif(sms.provider_response, ''), 'Gönderim sonucu lease süresi içinde kaydedilemedi; otomatik tekrar gönderilmedi.'),
        2000
      ),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.status = 'SENDING'
    and sms.lease_until <= clock_timestamp();

  get diagnostics expired_count = row_count;
  return expired_count;
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
declare
  new_claim_token uuid;
  new_lease_until timestamptz;
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return query select false, null::uuid, null::timestamptz;
    return;
  end if;

  perform public.expire_sms_claims();

  update public.sms_logs as sms
  set status = 'SENDING',
      claimed_by = p_device_id::text,
      claim_token = gen_random_uuid(),
      lease_until = clock_timestamp() + interval '2 minutes'
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

create or replace function public.renew_sms_claim(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_claim_token uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set lease_until = clock_timestamp() + interval '2 minutes'
  where sms.id = p_sms_id
    and sms.status = 'SENDING'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set status = 'UNKNOWN',
      provider_response = left(
        concat_ws(E'\n', nullif(sms.provider_response, ''), 'Claim bırakıldı; SMS gönderilip gönderilmediği doğrulanmamış olabilir. Otomatik tekrar gönderilmedi.'),
        2000
      ),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'SENDING'
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set status = 'SENT',
      provider_response = p_provider_response,
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'SENDING'
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
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set status = 'FAILED',
      provider_response = left(coalesce(nullif(trim(p_error), ''), 'SMS gönderimi başarısız.'), 2000),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'SENDING'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
end;
$$;

create or replace function public.mark_sms_unknown(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_claim_token uuid,
  p_detail text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return false;
  end if;

  update public.sms_logs as sms
  set status = 'UNKNOWN',
      provider_response = left(coalesce(nullif(trim(p_detail), ''), 'SMS gönderim sonucu doğrulanamadı; otomatik tekrar gönderilmedi.'), 2000),
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and sms.status = 'SENDING'
    and sms.claimed_by = p_device_id::text
    and sms.claim_token = p_claim_token
    and sms.lease_until > clock_timestamp();

  return found;
end;
$$;

create or replace function public.resolve_sms_uncertain(
  p_sms_id uuid,
  p_resolution text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;
  if p_resolution not in ('sent', 'retry') then
    raise exception 'Resolution must be sent or retry.';
  end if;

  update public.sms_logs as sms
  set status = case when p_resolution = 'sent' then 'SENT' else 'QUEUED' end,
      provider_response = case
        when p_resolution = 'sent' then left(concat_ws(E'\n', nullif(sms.provider_response, ''), 'Manuel olarak gönderildi olarak uzlaştırıldı.'), 2000)
        else left(concat_ws(E'\n', nullif(sms.provider_response, ''), 'Kullanıcı olası çift gönderim riskini kabul ederek yeniden kuyruğa aldı.'), 2000)
      end,
      claimed_by = null,
      claim_token = null,
      lease_until = null
  where sms.id = p_sms_id
    and (
      (p_resolution = 'sent' and sms.status = 'UNKNOWN')
      or (p_resolution = 'retry' and sms.status in ('UNKNOWN', 'FAILED'))
    )
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp());

  return found;
end;
$$;

revoke all on function public.is_authorized_app_user() from public, anon, authenticated;
grant execute on function public.is_authorized_app_user() to authenticated;

revoke all on function public.update_hatch_sms_draft(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.update_sms_message(uuid, text) from public, anon, authenticated;
revoke all on function public.queue_sms(uuid) from public, anon, authenticated;
revoke all on function public.expire_sms_claims() from public, anon, authenticated;
revoke all on function public.claim_sms(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.renew_sms_claim(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.release_sms_claim(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_sms_sent(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_sms_failed(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_sms_unknown(uuid, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.resolve_sms_uncertain(uuid, text) from public, anon, authenticated;
revoke all on function public.place_tray_allocations(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.transfer_batch_to_hatch_basket(uuid, uuid, integer) from public, anon, authenticated;

grant execute on function public.update_hatch_sms_draft(uuid, uuid, text, text) to authenticated;
grant execute on function public.update_sms_message(uuid, text) to authenticated;
grant execute on function public.queue_sms(uuid) to authenticated;
grant execute on function public.expire_sms_claims() to authenticated;
grant execute on function public.claim_sms(uuid, uuid, text) to authenticated;
grant execute on function public.renew_sms_claim(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.release_sms_claim(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.mark_sms_sent(uuid, uuid, text, uuid, text) to authenticated;
grant execute on function public.mark_sms_failed(uuid, uuid, text, uuid, text) to authenticated;
grant execute on function public.mark_sms_unknown(uuid, uuid, text, uuid, text) to authenticated;
grant execute on function public.resolve_sms_uncertain(uuid, text) to authenticated;
grant execute on function public.place_tray_allocations(uuid, jsonb) to authenticated;
grant execute on function public.transfer_batch_to_hatch_basket(uuid, uuid, integer) to authenticated;
