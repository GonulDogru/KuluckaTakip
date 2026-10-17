alter table machines add column if not exists machine_number text;
alter table machines add column if not exists active boolean not null default true;
alter table machines add constraint machines_machine_number_unique unique (machine_number);
alter table machines add constraint machines_capacity_positive check (capacity >= 0);

alter table racks add column if not exists rack_number text;
alter table racks add column if not exists capacity integer;
alter table racks add column if not exists positions_per_row integer;
alter table racks add column if not exists active boolean not null default true;

update racks
set
  rack_number = coalesce(rack_number, name),
  positions_per_row = coalesce(positions_per_row, column_count),
  capacity = coalesce(capacity, row_count * column_count)
where rack_number is null or positions_per_row is null or capacity is null;

alter table racks alter column rack_number set not null;
alter table racks alter column positions_per_row set not null;
alter table racks alter column capacity set not null;
alter table racks add constraint racks_machine_rack_number_unique unique (machine_id, rack_number);
alter table racks add constraint racks_dimensions_positive check (row_count > 0 and positions_per_row > 0);
alter table racks add constraint racks_capacity_matches_dimensions check (capacity = row_count * positions_per_row);

create table if not exists placement_cells (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  machine_id uuid not null references machines(id) on delete cascade,
  rack_id uuid not null references racks(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  position_number integer not null check (position_number > 0),
  created_at timestamptz not null default now(),
  constraint placement_cells_unique_cell unique (rack_id, row_number, position_number)
);

create or replace function validate_placement_cell_bounds()
returns trigger as $$
declare
  rack_row_count integer;
  rack_positions_per_row integer;
  rack_machine_id uuid;
begin
  select row_count, positions_per_row, machine_id
  into rack_row_count, rack_positions_per_row, rack_machine_id
  from racks
  where id = new.rack_id;

  if rack_row_count is null then
    raise exception 'Rack not found';
  end if;

  if new.machine_id <> rack_machine_id then
    raise exception 'Machine/rack mismatch';
  end if;

  if new.row_number > rack_row_count or new.position_number > rack_positions_per_row then
    raise exception 'Placement cell outside rack bounds';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists placement_cells_validate_bounds on placement_cells;
create trigger placement_cells_validate_bounds
before insert or update on placement_cells
for each row execute function validate_placement_cell_bounds();

create index if not exists placement_cells_batch_id_idx on placement_cells(batch_id);
create index if not exists placement_cells_machine_id_idx on placement_cells(machine_id);
create index if not exists placement_cells_rack_id_idx on placement_cells(rack_id);

alter table hatch_baskets add column if not exists basket_number text;
alter table hatch_baskets add column if not exists capacity integer not null default 0;
alter table hatch_baskets add column if not exists active boolean not null default true;
update hatch_baskets set basket_number = coalesce(basket_number, name);
alter table hatch_baskets alter column basket_number set not null;
alter table hatch_baskets add constraint hatch_baskets_machine_basket_unique unique (machine_id, basket_number);
alter table hatch_baskets add constraint hatch_baskets_capacity_positive check (capacity >= 0);

alter table hatch_basket_placements add column if not exists egg_count integer not null default 0;
alter table hatch_basket_placements add constraint hatch_basket_placements_egg_count_positive check (egg_count > 0);

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

  delete from placement_cells where batch_id = p_batch_id;
  update batches set status = 'HATCHING' where id = p_batch_id;
end;
$$ language plpgsql;
