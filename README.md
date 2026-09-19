# Job Hunter Control

Secure control plane for discovering, scoring and preparing Yassine Afif's alternance and internship applications.

## Current safety mode

`PREPARE_ONLY` is mandatory. The system can inspect offers, calculate the saved 100-point score, generate drafts from verified facts, and pause for approval. It cannot submit an application.

## Components

- Next.js 16 dashboard with offers, applications, documents, questions, runs and settings.
- Supabase Auth + the existing 10 RLS-protected tables in `IA AGENT HUNTER`.
- Server-only Gemini job analysis endpoint.
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
2. Apply the SQL in `supabase/migrations/20260920120000_profile_answers.sql` (Supabase → SQL editor). It creates the reusable answer bank.
3. Create a Railway service using `Dockerfile.worker` and set `WORKER_SHARED_SECRET`.
4. Put the Railway public URL (`WORKER_BASE_URL`) and the same secret (`WORKER_SHARED_SECRET`) into Vercel.
5. Set `APPLICATION_MODE=PREPARE_ONLY` in both services (a missing value behaves the same; any other value is refused).
6. Connect the offer scanner: see [docs/SCANNER.md](docs/SCANNER.md).

The **Réglages** tab shows which integrations are connected.

## Questions and reusable answers

Questions found on offers or forms are mapped to a canonical key (nationality, address, residence permit...).
You answer once in the **Questions** tab; the answer is remembered and reused automatically, including for
identical open questions in other applications and for select fields (mapped onto the form's own options).
Sensitive answers are never guessed onto a different option, answers with a validity date are asked again
when they expire, and offer-specific questions (motivation, salary) are not remembered by default.

## Changing a CV or cover letter

In **Documents**: *Demander une modification* (Gemini writes a new version from your instruction and the
verified profile only; the old version is kept) or *Modifier moi-même* (edit the text directly; an approved
document is never overwritten, the edit becomes a new draft version).

## Tests

`npm test` runs the logic tests (question matching, answer memory, scan parsing and de-duplication).

## Existing Android prototype

The unrelated Conversation Copilot prototype already present in this repository is preserved under `conversation-copilot-android/`.
