-- Alerts for the restaurant when guests act online (new reservation, guest cancels, waitlist or line sign-up).
-- Each restaurant can switch push and email alerts off (on by default); each person turns push on per device.

alter table public.restaurants
  add column notify_push boolean not null default true,
  add column notify_email boolean not null default true;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- People manage only their own devices. Sending uses the service role, which bypasses RLS.
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
