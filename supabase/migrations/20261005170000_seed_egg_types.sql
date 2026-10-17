insert into egg_types (name, incubation_days, transfer_day)
values
  ('Tavuk', 21, 20),
  ('Hindi', 28, 25),
  ('Bıldırcın', 18, 15),
  ('Kaz', 30, 27),
  ('Ördek', 30, 27),
  ('Keklik', 25, 22)
on conflict (name) do update
set incubation_days = excluded.incubation_days,
    active = true;
