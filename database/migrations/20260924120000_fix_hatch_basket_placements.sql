-- Fix: hatch_basket_placements üzerindeki hücre bazlı unique constraint
-- aynı sepete ikinci bir aktarımı engelliyordu.
--
-- Eski davranış:
--   * hatch_basket_cell_unique unique (hatch_basket_id, row_no, column_no)
--   * transfer_batch_to_hatch_basket her aktarımda (row_no = 1, column_no = 1) yazıyordu.
--   * Sonuç: bir sepete yalnızca tek aktarım yapılabiliyordu; ikinci aktarım unique ihlali veriyordu.
--
-- Yeni davranış:
--   * Hücre bazlı constraint kaldırılır; yerine (hatch_basket_id, batch_id) unique konur.
--     Böylece aynı parti aynı sepete mükerrer aktarılamaz, farklı partiler aynı sepete yazılabilir.
--   * RPC row_no değerini sepet içindeki sıradaki boş sıra olarak üretir (column_no = 1).
--
-- Not: Bu migration, 20260923120000_tray_allocations.sql içindeki
-- transfer_batch_to_hatch_basket fonksiyonunu güvenli şekilde yeniden tanımlar.
-- Uygulama kodu (hatchBasketService) yalnızca egg_count toplamını kullandığından
-- row_no/column_no değerlerinin kullanıcı arayüzüne etkisi yoktur.

alter table hatch_basket_placements
  drop constraint if exists hatch_basket_cell_unique;

alter table hatch_basket_placements
  add constraint hatch_basket_placements_basket_batch_unique unique (hatch_basket_id, batch_id);

create or replace function transfer_batch_to_hatch_basket(
  p_batch_id uuid,
  p_hatch_basket_id uuid,
  p_egg_count integer
)
returns void as $$
declare
  basket_capacity integer;
  basket_used integer;
  batch_customer uuid;
  next_row integer;
begin
  if p_egg_count <= 0 then
    raise exception 'Egg count must be positive';
  end if;

  select capacity into basket_capacity
  from hatch_baskets
  where id = p_hatch_basket_id and active = true;

  if basket_capacity is null then
    raise exception 'Hatch basket not found';
  end if;

  select coalesce(sum(egg_count), 0) into basket_used
  from hatch_basket_placements
  where hatch_basket_id = p_hatch_basket_id;

  if basket_used + p_egg_count > basket_capacity then
    raise exception 'Hatch basket capacity exceeded';
  end if;

  select customer_id into batch_customer from batches where id = p_batch_id for update;
  if batch_customer is null then
    raise exception 'Batch not found';
  end if;

  if exists (
    select 1 from hatch_basket_placements
    where hatch_basket_id = p_hatch_basket_id and batch_id = p_batch_id
  ) then
    raise exception 'Batch already transferred to this hatch basket';
  end if;

  select coalesce(max(row_no), 0) + 1 into next_row
  from hatch_basket_placements
  where hatch_basket_id = p_hatch_basket_id;

  insert into hatch_basket_placements (hatch_basket_id, batch_id, row_no, column_no, egg_count)
  values (p_hatch_basket_id, p_batch_id, next_row, 1, p_egg_count);

  delete from tray_allocations where batch_id = p_batch_id;
  delete from placement_cells where batch_id = p_batch_id;
  update batches set status = 'HATCHING' where id = p_batch_id;
end;
$$ language plpgsql;
