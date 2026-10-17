create or replace function private.is_registered_sms_device(
  p_device_id uuid,
  p_device_secret text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private, auth, pg_temp
as $$
  select private.is_authorized_app_user();
$$;

create or replace function public.claim_sms_for_send(
  p_sms_id uuid,
  p_device_id uuid,
  p_device_secret text,
  p_expected_phone text,
  p_expected_message text
)
returns table (
  claimed boolean,
  claim_token uuid,
  lease_until timestamptz,
  sms_phone text,
  sms_message text
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions, pg_temp
as $$
declare
  new_claim_token uuid;
  new_lease_until timestamptz;
  claimed_phone text;
  claimed_message text;
begin
  if not private.is_authorized_app_user()
    or not private.is_registered_sms_device(p_device_id, p_device_secret) then
    return query select false, null::uuid, null::timestamptz, null::text, null::text;
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
    and sms.phone = p_expected_phone
    and sms.message = p_expected_message
    and (sms.lease_until is null or sms.lease_until <= clock_timestamp())
  returning sms.claim_token, sms.lease_until, sms.phone, sms.message
  into new_claim_token, new_lease_until, claimed_phone, claimed_message;

  if found then
    return query select true, new_claim_token, new_lease_until, claimed_phone, claimed_message;
  else
    return query select false, null::uuid, null::timestamptz, null::text, null::text;
  end if;
end;
$$;

revoke all on function public.claim_sms(uuid, uuid, text) from public, anon, authenticated;

revoke all on function public.claim_sms_for_send(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_sms_for_send(uuid, uuid, text, text, text) to authenticated;
