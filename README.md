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
2. Create a Railway service using `Dockerfile.worker` and set `WORKER_SHARED_SECRET`.
3. Put the Railway public URL and the same secret into Vercel.
4. Keep `APPLICATION_MODE=PREPARE_ONLY` in both services.

## Existing Android prototype

The unrelated Conversation Copilot prototype already present in this repository is preserved under `conversation-copilot-android/`.
