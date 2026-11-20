begin;
create or replace function public.delete_sms_draft(p_sms_id uuid, p_status text, p_message text, p_phone text)
returns void language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
declare b_id uuid; deleted_id uuid;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  select batch_id into b_id from public.sms_logs where id = p_sms_id;
  if b_id is not null then perform 1 from public.batches where id = b_id for update; end if;
  delete from public.sms_logs where id = p_sms_id and status::text = p_status
    and status::text in ('PENDING', 'QUEUED', 'FAILED') and message = p_message and phone = p_phone returning id into deleted_id;
  if deleted_id is null then raise exception 'SMS değişti veya silinebilir durumda değil. Listeyi yenileyin.'; end if;
end;
$$;
revoke all on function public.delete_sms_draft(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.delete_sms_draft(uuid, text, text, text) to authenticated;
commit;
