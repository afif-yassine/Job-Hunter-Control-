-- Short summary of an offer (missions, stack, conditions), written once by
-- the first analysis of the offer and shown to every account.
alter table public.offers add column if not exists summary jsonb;
