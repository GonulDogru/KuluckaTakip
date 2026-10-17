alter table racks add column if not exists tray_count integer;
alter table racks add column if not exists tray_capacity integer;

update racks
set
  tray_count = coalesce(tray_count, row_count, 10),
  tray_capacity = coalesce(tray_capacity, positions_per_row, 10),
  capacity = coalesce(capacity, coalesce(tray_count, row_count, 10) * coalesce(tray_capacity, positions_per_row, 10))
where tray_count is null or tray_capacity is null or capacity is null;

alter table racks alter column tray_count set not null;
alter table racks alter column tray_capacity set not null;
alter table racks add constraint racks_tray_config_positive check (tray_count > 0 and tray_capacity > 0);

create table if not exists rack_trays (
  id uuid primary key default gen_random_uuid(),
  rack_id uuid not null references racks(id) on delete cascade,
  tray_number integer not null check (tray_number > 0),
  capacity integer not null check (capacity > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint rack_trays_unique_number unique (rack_id, tray_number)
);

create table if not exists tray_allocations (
  id uuid primary key default gen_random_uuid(),
  tray_id uuid not null references rack_trays(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  egg_count integer not null check (egg_count > 0),
  created_at timestamptz not null default now()
);

create index if not exists rack_trays_rack_id_idx on rack_trays(rack_id);
create index if not exists tray_allocations_tray_id_idx on tray_allocations(tray_id);
create index if not exists tray_allocations_batch_id_idx on tray_allocations(batch_id);

insert into rack_trays (rack_id, tray_number, capacity)
select racks.id, series.tray_number, racks.tray_capacity
from racks
cross join lateral generate_series(1, racks.tray_count) as series(tray_number)
on conflict (rack_id, tray_number) do nothing;

create or replace function validate_tray_allocation_capacity()
returns trigger as $$
declare
  tray_capacity integer;
  tray_used integer;
  batch_capacity integer;
  batch_used integer;
begin
  select capacity into tray_capacity
  from rack_trays
  where id = new.tray_id
  for update;

  if tray_capacity is null then
    raise exception 'Tray not found';
  end if;

  select coalesce(sum(egg_count), 0) into tray_used
  from tray_allocations
  where tray_id = new.tray_id
    and id <> coalesce(new.id, gen_random_uuid());

  if tray_used + new.egg_count > tray_capacity then
    raise exception 'Tray capacity exceeded';
  end if;

  select egg_count into batch_capacity
  from batches
  where id = new.batch_id
  for update;

  if batch_capacity is null then
    raise exception 'Batch not found';
  end if;

  select coalesce(sum(egg_count), 0) into batch_used
  from tray_allocations
  where batch_id = new.batch_id
    and id <> coalesce(new.id, gen_random_uuid());

  if batch_used + new.egg_count > batch_capacity then
    raise exception 'Batch egg count exceeded';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists tray_allocations_validate_capacity on tray_allocations;
create trigger tray_allocations_validate_capacity
before insert or update on tray_allocations
for each row execute function validate_tray_allocation_capacity();

create or replace function place_tray_allocations(
  p_batch_id uuid,
  p_allocations jsonb
)
returns setof tray_allocations as $$
begin
  return query
  insert into tray_allocations (batch_id, tray_id, egg_count)
  select
    p_batch_id,
    (item->>'trayId')::uuid,
    (item->>'eggCount')::integer
  from jsonb_array_elements(p_allocations) as item
  where (item->>'eggCount')::integer > 0
  returning *;
end;
$$ language plpgsql;

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
begin
  if p_egg_count <= 0 then
    raise exception 'Egg count must be positive';
  end if;

  select capacity into basket_capacity from hatch_baskets where id = p_hatch_basket_id and active = true;
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

  insert into hatch_basket_placements (hatch_basket_id, batch_id, row_no, column_no, egg_count)
  values (p_hatch_basket_id, p_batch_id, 1, 1, p_egg_count);

  delete from tray_allocations where batch_id = p_batch_id;
  delete from placement_cells where batch_id = p_batch_id;
  update batches set status = 'HATCHING' where id = p_batch_id;
end;
$$ language plpgsql;
