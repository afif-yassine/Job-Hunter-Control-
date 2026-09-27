# Job Hunter Control

Secure control plane for discovering, scoring and preparing alternance and internship applications
(built for Yassine Afif first, designed so each account only sees its own data).

## Current safety mode

`PREPARE_ONLY` is mandatory. The system can inspect offers, calculate the saved 100-point score, generate drafts from verified facts, and pause for approval. It cannot submit an application.

## Components

- Next.js 16 dashboard with offers, applications, documents, questions, runs and settings.
- Supabase Auth + the existing 10 RLS-protected tables in `IA AGENT HUNTER`.
- One AI layer (`lib/ai.ts`): the model is configuration (`AI_MODEL…`), and every score/document records its model.
- Search on many sources + company careers pages (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee), with
  cross-platform de-duplication, "already applied elsewhere" memory and suspected-offer review.
- Scheduled server run for every account (`/api/cron/tick`): search → score → documents, no browser needed.
- Daily limits per account (`lib/quota.ts`): searches, analyses, CV + letters.
- Railway-ready Playwright worker with authenticated, resumable safety boundary.
- Vercel-ready standalone build.

## Local setup

```bash
cp .env.example .env.local
npm ci
npm run typecheck
npm run build
npm run dev
```

Use the project URL and **publishable key** from Supabase. Never use a service-role key in a `NEXT_PUBLIC_` variable.

## Deploy

1. Create/import this repository in Vercel and set the dashboard variables from `.env.example`.
2. Apply the SQL files of `supabase/migrations/` in order (Supabase → SQL editor). All are safe to run twice.
3. Create a Railway service using `Dockerfile.worker` and set `WORKER_SHARED_SECRET`.
4. Put the Railway public URL (`WORKER_BASE_URL`) and the same secret (`WORKER_SHARED_SECRET`) into Vercel.
5. Set `APPLICATION_MODE=PREPARE_ONLY` in both services (a missing value behaves the same; any other value is refused).
6. Connect an offer source from the dashboard (Réglages > Sources; JSearch covers LinkedIn, Indeed, WTTJ… in 3 minutes) and set `INTEGRATIONS_SECRET` in Vercel: see [docs/SCANNER.md](docs/SCANNER.md).

7. For the automatic server run, set `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel, then schedule it every
   30 min from Supabase (docs/SCANNER.md §5).

The **Réglages** tab shows which integrations are connected.

## Questions and reusable answers

Questions found on offers or forms are mapped to a canonical key (nationality, address, residence permit...).
You answer once in the **Questions** tab; the answer is remembered and reused automatically, including for
identical open questions in other applications and for select fields (mapped onto the form's own options).
Sensitive answers are never guessed onto a different option, answers with a validity date are asked again
when they expire, and offer-specific questions (motivation, salary) are not remembered by default.

## Changing a CV or cover letter

In **Documents**: *Demander à l’IA* (Gemini writes a new version from your instruction and the
verified profile only; the old version is kept), *Modifier* (edit the text directly; an approved
document is never overwritten, the edit becomes a new draft version), or *LaTeX* (download the `.tex`
source or open it in Overleaf to edit the code yourself — one column, ATS-friendly, one page).

## Tests

`npm test` runs the logic tests (question matching, answer memory, sources, de-duplication, scam signals,
quotas, the server run, LaTeX export — compiled when `pdflatex` is installed).

## Existing Android prototype

The unrelated Conversation Copilot prototype already present in this repository is preserved under `conversation-copilot-android/`.
