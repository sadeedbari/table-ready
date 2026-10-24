-- Staff change a reservation (time, party size, table). The table is re-checked: the current table is kept if it still fits and is free,
-- otherwise the smallest free table that fits is used; the exclusion constraint is the final word on double-booking.
-- Staff changes ignore online booking limits (opening hours, notice, party limit), like adding a booking by hand.
-- Only the server (service role) can call this, after checking the person is on the restaurant's team.

create or replace function public.change_reservation(
  p_reservation uuid, p_starts timestamptz, p_party int, p_table uuid default null
) returns table (table_name text, ends_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  x public.reservations;
  r public.restaurants;
  mins int;
  ends timestamptz;
  t record;
begin
  select * into x from public.reservations where id = p_reservation for update;
  if not found then raise exception 'unknown_reservation'; end if;
  if x.status not in ('confirmed', 'seated') then raise exception 'not_editable'; end if;
  if p_party < 1 then raise exception 'bad_party'; end if;
  select * into r from public.restaurants where id = x.restaurant_id;

  select (e ->> 'minutes')::int into mins
    from jsonb_array_elements(r.turn_times) e
    where (e ->> 'upTo')::int >= p_party
    order by (e ->> 'upTo')::int limit 1;
  mins := coalesce(mins, 120);
  ends := p_starts + make_interval(mins => mins);

  -- A chosen table is the only candidate. Otherwise try the current table first, then the others from smallest up.
  for t in
    select dt.id, dt.name from public.dining_tables dt
    where dt.restaurant_id = x.restaurant_id and dt.active and dt.seats >= p_party
      and (p_table is null or dt.id = p_table)
    order by (dt.id = x.table_id) desc, dt.seats, dt.position, dt.name
  loop
    begin
      update public.reservations
         set starts_at = p_starts, ends_at = ends, party_size = p_party, table_id = t.id,
             reminder_sent_at = case when p_starts <> x.starts_at then null else x.reminder_sent_at end
       where id = x.id;
      return query select t.name::text, ends;
      return;
    exception when exclusion_violation then
      continue;   -- that table is taken at the new time: try the next one
    end;
  end loop;

  -- A booking that never had a table (added by hand) can still move without one.
  if x.table_id is null and p_table is null then
    update public.reservations set starts_at = p_starts, ends_at = ends, party_size = p_party,
           reminder_sent_at = case when p_starts <> x.starts_at then null else x.reminder_sent_at end
     where id = x.id;
    return query select null::text, ends;
    return;
  end if;
  raise exception 'no_table';
end;
$$;
revoke all on function public.change_reservation(uuid, timestamptz, int, uuid) from public, anon, authenticated;
grant execute on function public.change_reservation(uuid, timestamptz, int, uuid) to service_role;
