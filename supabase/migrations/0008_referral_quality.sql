-- A referral only counts once the friend actually uses Lumo, so two throwaway
-- sign-ups can't unlock a Plus trial.

alter table public.referrals
  add column if not exists qualified_at timestamptz;

-- Referrals made before this rule shipped keep their credit.
update public.referrals set qualified_at = created_at where qualified_at is null;

create index if not exists referrals_qualified_idx on public.referrals (referrer_id, qualified_at);
