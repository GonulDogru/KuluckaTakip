update public.egg_types
set incubation_days = 28
where name = 'Ördek'
  and incubation_days <> 28;
