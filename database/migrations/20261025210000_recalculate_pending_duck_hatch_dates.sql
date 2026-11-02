update public.batches as batch
set incubation_date = batch.incubation_date
from public.egg_types as egg_type
where batch.egg_type_id = egg_type.id
  and egg_type.name = 'Ördek'
  and batch.incubation_date is not null
  and batch.status in ('RECEIVED', 'INCUBATING', 'TRANSFER_DUE', 'HATCHING');
