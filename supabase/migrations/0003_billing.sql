-- Billing: Stripe customer + subscription state on profiles.

alter table public.profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists plan_interval text check (plan_interval in ('month', 'year')),
  add column if not exists plan_status text,
  add column if not exists current_period_end timestamptz;

-- Users could previously update their own profile row, including `plan`.
-- Plans are now written only by the server (service role) from Stripe webhooks.
drop policy if exists "own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = id);

-- Stripe retries webhooks; remember which events were already applied.
create table if not exists public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
