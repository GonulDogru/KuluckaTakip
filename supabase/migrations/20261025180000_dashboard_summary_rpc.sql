create or replace function public.get_dashboard_summary()
returns table (
  customer_count bigint,
  batch_count bigint,
  egg_count bigint,
  total_debt numeric
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if not public.is_authorized_app_user() then
    raise exception 'App access is not authorized.' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from public.customers as customer where customer.is_active),
    count(batch.id),
    coalesce(sum(batch.egg_count), 0)::bigint,
    coalesce(
      sum(batch.total_price - coalesce(payment_totals.paid_total, 0)),
      0
    )::numeric
  from public.batches as batch
  left join (
    select payment.batch_id, sum(payment.amount)::numeric as paid_total
    from public.payments as payment
    group by payment.batch_id
  ) as payment_totals on payment_totals.batch_id = batch.id;
end;
$$;

revoke all on function public.get_dashboard_summary() from public, anon, authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
