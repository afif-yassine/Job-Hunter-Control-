-- Three extra France Travail partner APIs, free, same client_id/secret as
-- "Offres d'emploi": Open Formation (training suggestions), Marché du
-- travail (tension/salary context) and Accès à l'emploi des demandeurs
-- d'emploi (6-month return-to-work rate, admin insight). Additive and safe
-- to run more than once.

alter table public.jobs add column if not exists rome_code text;
alter table public.jobs add column if not exists market_tension_label text;
alter table public.jobs add column if not exists market_note text;
alter table public.jobs add column if not exists training_suggestions jsonb;
comment on column public.jobs.rome_code is 'ROME code from France Travail, when the offer comes from that source. Used to enrich with Marché du travail / Open Formation.';
comment on column public.jobs.market_tension_label is 'From the Marché du travail API: how contested this métier/territory is (e.g. "Tension forte").';
comment on column public.jobs.market_note is 'Short, human-readable note built from Marché du travail (salary range, hiring volume).';
comment on column public.jobs.training_suggestions is 'Up to 3 trainings from Open Formation, suggested when the analysis found a skill gap. [{title, provider, url, durationHours, funded}]';

create index if not exists jobs_rome_code_idx on public.jobs (rome_code) where rome_code is not null;
