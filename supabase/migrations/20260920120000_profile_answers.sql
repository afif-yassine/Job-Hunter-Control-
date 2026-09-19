-- Reusable answers ("answer bank") + richer application questions.
-- Safe to run more than once.

create table if not exists public.profile_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  question_key text not null,
  label text not null,
  category text,
  answer_type text not null default 'text',
  answer text not null,
  sensitive boolean not null default false,
  expires_at timestamptz,
  source_question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_key)
);

alter table public.profile_answers enable row level security;

drop policy if exists profile_answers_owner_all on public.profile_answers;
create policy profile_answers_owner_all on public.profile_answers
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create index if not exists profile_answers_user_idx on public.profile_answers(user_id);

-- Extra metadata on questions so the dashboard can render the right input
-- (text, select, yes/no, date) and recognise duplicates.
alter table public.application_questions add column if not exists question_key text;
alter table public.application_questions add column if not exists answer_type text;
alter table public.application_questions add column if not exists options jsonb;
alter table public.application_questions add column if not exists auto_answered boolean not null default false;
alter table public.application_questions add column if not exists answered_at timestamptz;

create index if not exists application_questions_key_idx
  on public.application_questions(user_id, question_key);

-- Speeds up the duplicate check done by the offer scanner.
create index if not exists jobs_user_fingerprint_idx on public.jobs(user_id, fingerprint);
