create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table profiles (
  id uuid primary key,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null, 
  phone_normalized text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_normalized_unique unique (phone_normalized)
);

create table egg_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  incubation_days integer not null check (incubation_days > 0),
  transfer_day integer not null check (transfer_day > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table breeds (
  id uuid primary key default gen_random_uuid(),
  egg_type_id uuid not null references egg_types(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint breeds_egg_type_name_unique unique (egg_type_id, name)
);

create table machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  model text,
  status text not null default 'IDLE',
  capacity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table racks (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  name text not null,
  row_count integer not null,
  column_count integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  batch_no text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  egg_type_id uuid not null references egg_types(id) on delete restrict,
  breed_id uuid references breeds(id) on delete set null,
  egg_count integer not null check (egg_count > 0),
  received_date date not null,
  incubation_date date,
  transfer_date date,
  expected_hatch_date date,
  unit_price numeric(12,2) not null default 0,
  total_price numeric(12,2) not null default 0,
  status text not null default 'RECEIVED',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_status_check check (
    status in ('RECEIVED', 'INCUBATING', 'TRANSFER_DUE', 'HATCHING', 'HATCHED', 'DELIVERED', 'CANCELLED')
  )
);

create sequence batch_no_seq;

create or replace function generate_batch_no()
returns trigger as $$
begin
  if new.batch_no is null or length(trim(new.batch_no)) = 0 then
    new.batch_no = 'P-' || extract(year from coalesce(new.received_date, current_date))::text || '-' ||
      lpad(nextval('batch_no_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function calculate_batch_dates()
returns trigger as $$
declare
  rules record;
begin
  select incubation_days, transfer_day into rules from egg_types where id = new.egg_type_id;

  if new.incubation_date is not null and rules is not null then
    new.transfer_date = new.incubation_date + rules.transfer_day;
    new.expected_hatch_date = new.incubation_date + rules.incubation_days;
  end if;

  new.total_price = new.egg_count * new.unit_price;
  return new;
end;
$$ language plpgsql;

create table placements (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  rack_id uuid not null references racks(id) on delete cascade,
  row_no integer not null,
  column_no integer not null,
  egg_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint placements_cell_unique unique (rack_id, row_no, column_no)
);

create table hatch_baskets (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid references machines(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table hatch_basket_placements (
  id uuid primary key default gen_random_uuid(),
  hatch_basket_id uuid not null references hatch_baskets(id) on delete cascade,
  batch_id uuid not null references batches(id) on delete cascade,
  row_no integer not null,
  column_no integer not null,
  egg_count integer not null default 0,
  created_at timestamptz not null default now(),
  constraint hatch_basket_cell_unique unique (hatch_basket_id, row_no, column_no)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete restrict,
  batch_id uuid not null references batches(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'Nakit',
  payment_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table hatch_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  hatched_count integer not null default 0,
  failed_count integer not null default 0,
  result_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sms_logs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  batch_id uuid references batches(id) on delete set null,
  phone text not null,
  message text not null,
  status text not null default 'PENDING',
  provider_response text,
  created_at timestamptz not null default now()
);

create view batch_payment_summaries as
select
  b.id as batch_id,
  b.total_price,
  coalesce(sum(p.amount), 0)::numeric(12,2) as paid_total,
  (b.total_price - coalesce(sum(p.amount), 0))::numeric(12,2) as remaining_debt
from batches b
left join payments p on p.batch_id = b.id
group by b.id;

create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger customers_set_updated_at before update on customers for each row execute function set_updated_at();
create trigger machines_set_updated_at before update on machines for each row execute function set_updated_at();
create trigger racks_set_updated_at before update on racks for each row execute function set_updated_at();
create trigger batches_set_updated_at before update on batches for each row execute function set_updated_at();
create trigger hatch_baskets_set_updated_at before update on hatch_baskets for each row execute function set_updated_at();
create trigger hatch_results_set_updated_at before update on hatch_results for each row execute function set_updated_at();
create trigger batches_generate_batch_no before insert on batches for each row execute function generate_batch_no();
create trigger batches_calculate_dates before insert or update on batches for each row execute function calculate_batch_dates();

create index customers_phone_idx on customers (phone);
create index customers_phone_normalized_idx on customers (phone_normalized);
create index breeds_egg_type_id_idx on breeds (egg_type_id);
create index racks_machine_id_idx on racks (machine_id);
create index batches_customer_id_idx on batches (customer_id);
create index batches_egg_type_id_idx on batches (egg_type_id);
create index batches_status_idx on batches (status);
create index placements_batch_id_idx on placements (batch_id);
create index placements_rack_id_idx on placements (rack_id);
create index hatch_basket_placements_batch_id_idx on hatch_basket_placements (batch_id);
create index payments_customer_id_idx on payments (customer_id);
create index payments_batch_id_idx on payments (batch_id);
create index hatch_results_batch_id_idx on hatch_results (batch_id);
create index sms_logs_customer_id_idx on sms_logs (customer_id);

insert into egg_types (name, incubation_days, transfer_day)
values ('Tavuk', 21, 20)
on conflict (name) do nothing;
