-- Rate limits for the public forms (reserve, waitlist, walk-in line, updates sign-up, cancel). Kept in the database so every server instance
-- shares the same count. A visitor is stored only as a hash, never as a raw address.
-- hit_rate_limit() answers "may this visitor do this again?": it counts the visitor's recent hits in a bucket and, if there is room, records one.

create table public.rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  key text not null,
  at timestamptz not null default clock_timestamp()
);
create index rate_limit_hits_lookup_idx on public.rate_limit_hits (bucket, key, at desc);
alter table public.rate_limit_hits enable row level security;   -- no policies: only the server (service role) can read or write

create or replace function public.hit_rate_limit(p_bucket text, p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  -- one visitor's attempts are handled one at a time, so two requests at the same instant cannot both slip under the limit
  perform pg_advisory_xact_lock(hashtextextended(p_bucket || ':' || p_key, 0));
  select count(*) into n from public.rate_limit_hits
   where bucket = p_bucket and key = p_key and at > clock_timestamp() - make_interval(secs => p_window_seconds);
  if n >= p_max then return false; end if;
  insert into public.rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return true;
end;
$$;
revoke all on function public.hit_rate_limit(text, text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, text, int, int) to service_role;
