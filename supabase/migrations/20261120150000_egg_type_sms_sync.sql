begin;
create or replace function private.sync_egg_type_sms_trigger()
returns trigger language plpgsql security definer set search_path = pg_catalog, public, private, pg_temp as $$
declare item record;
begin
  if new.name is distinct from old.name then
    for item in select id from public.batches where egg_type_id = new.id order by id loop
      perform private.sync_hatch_sms(item.id, false);
    end loop;
  end if;
  return new;
end;
$$;
create trigger egg_types_sync_sms after update of name on public.egg_types
for each row execute function private.sync_egg_type_sms_trigger();
commit;
