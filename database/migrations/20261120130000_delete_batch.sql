begin;
create table private.deleted_batches (
  id bigint generated always as identity primary key,
  user_id uuid, batch jsonb not null, payments jsonb not null,
  deleted_at timestamptz not null default now()
);
revoke all on private.deleted_batches from public, anon, authenticated;
create or replace function public.delete_batch(p_batch_id uuid, p_expected_updated_at timestamptz, p_expected_payments jsonb)
returns void language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
declare b public.batches; saved_payments jsonb;
begin
  if not private.is_authorized_app_user() then raise exception 'App access is not authorized.' using errcode = '42501'; end if;
  select * into b from public.batches where id = p_batch_id for update;
  if not found then raise exception 'Kabul bulunamadı.'; end if;
  if b.updated_at is distinct from p_expected_updated_at then raise exception 'Kabul değişti. Sayfayı yenileyip tekrar deneyin.'; end if;
  if exists (
    (select id, updated_at, amount, voided_at from public.payments where batch_id = b.id
     except select id, updated_at, amount, voided_at from jsonb_to_recordset(p_expected_payments) as x(id uuid, updated_at timestamptz, amount numeric, voided_at timestamptz))
    union all
    (select id, updated_at, amount, voided_at from jsonb_to_recordset(p_expected_payments) as x(id uuid, updated_at timestamptz, amount numeric, voided_at timestamptz)
     except select id, updated_at, amount, voided_at from public.payments where batch_id = b.id)
  ) then raise exception 'Ödemeler değişti. Sayfayı yenileyip tekrar deneyin.'; end if;
  if exists (select 1 from public.sms_logs where batch_id = b.id and status in ('SENDING', 'UNKNOWN')) then
    raise exception 'SMS gönderimi sürüyor veya sonucu belirsiz. Önce SMS durumunu kontrol edin.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) into saved_payments from public.payments p where batch_id = b.id;
  insert into private.deleted_batches(user_id, batch, payments) values(auth.uid(), to_jsonb(b), saved_payments);
  delete from public.sms_logs where batch_id = b.id and status not in ('SENT', 'DELIVERED');
  delete from public.batches where id = b.id;
end;
$$;
revoke all on function public.delete_batch(uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.delete_batch(uuid, timestamptz, jsonb) to authenticated;
commit;
