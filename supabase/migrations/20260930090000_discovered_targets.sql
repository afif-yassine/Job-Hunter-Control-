-- Companies the app finds by itself on a recruitment platform (Greenhouse,
-- Lever, Ashby…) from the links of the offers it scans — see lib/scan/discover.ts.
-- Shape: {"items":[{"key":"lever:acme","company":"Acme","via":"jsearch:linkedin",
--          "link":"https://jobs.lever.co/acme/…","firstSeen":"…","lastSeen":"…"}],
--         "ignored":["greenhouse:foo"]}
alter table public.user_settings
  add column if not exists discovered_targets jsonb not null default '{"items":[],"ignored":[]}'::jsonb;

comment on column public.user_settings.discovered_targets is
  'Careers boards discovered automatically from offer links, plus the ones the user chose to stop following.';
