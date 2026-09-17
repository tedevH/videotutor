-- Plus / Pro plans and "invite 2 friends, unlock 14 days of Plus".

alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references auth.users on delete set null,
  add column if not exists plus_trial_until timestamptz,
  add column if not exists referral_rewards int not null default 0;


create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users on delete cascade,
  referred_id uuid not null unique references auth.users on delete cascade,  -- a person can only be referred once
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index if not exists referrals_referrer on public.referrals (referrer_id);

alter table public.referrals enable row level security;
create policy "see own referrals" on public.referrals for select using (auth.uid() = referrer_id);

-- Give every existing and future profile a short shareable code.
create or replace function public.new_referral_code() returns text language sql as $$
  select lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

update public.profiles set referral_code = public.new_referral_code() where referral_code is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, referral_code)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', public.new_referral_code());
  return new;
end;
$$;
