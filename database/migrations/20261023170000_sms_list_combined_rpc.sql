create or replace function public.list_sms_logs_with_expired_claims()
returns table (
  id uuid,
  customer_id uuid,
  batch_id uuid,
  phone text,
  message text,
  status text,
  created_at timestamptz,
  provider_response text,
  claimed_by text,
  lease_until timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
begin
  if not private.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;

  perform public.expire_sms_claims();

  return query
  select
    sms.id,
    sms.customer_id,
    sms.batch_id,
    sms.phone,
    sms.message,
    sms.status,
    sms.created_at,
    sms.provider_response,
    sms.claimed_by,
    sms.lease_until
  from public.sms_logs as sms
  order by sms.created_at desc;
end;
$$;

revoke all on function public.list_sms_logs_with_expired_claims() from public, anon, authenticated;
grant execute on function public.list_sms_logs_with_expired_claims() to authenticated;
