-- Guests: try Lumo before making an account. Supabase anonymous sign-in gives every visitor a real
-- user row, so sessions, messages and usage all work unchanged and RLS still isolates them.
-- Enable it first: Authentication → Sign In / Providers → Anonymous sign-ins.

alter table public.profiles
  add column if not exists is_guest boolean not null default false,
  -- Where this person came from (?ref=library, ?ref=discord…), kept through the upgrade to a real account.
  add column if not exists ref_source text;

create index if not exists profiles_guest_idx on public.profiles (is_guest, created_at);

-- New accounts: carry the anonymous flag onto the profile so the server knows what to allow.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, referral_code, is_guest)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    public.new_referral_code(),
    coalesce(new.is_anonymous, false)
  );
  return new;
end;
$$;

-- A guest who adds an email keeps the same row: their first question and its answer come with them.
create or replace function public.handle_user_upgraded() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.is_anonymous and not new.is_anonymous then
    update public.profiles set is_guest = false, email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_upgraded on auth.users;
create trigger on_auth_user_upgraded
  after update on auth.users
  for each row execute function public.handle_user_upgraded();
