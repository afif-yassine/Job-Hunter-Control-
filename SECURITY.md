# Security model

- The browser receives only the Supabase publishable key; the service-role key is never used by the dashboard.
- Every public table must keep RLS enabled with ownership policies based on `auth.uid() = user_id`.
- Gemini receives only the job text and verified profile facts; it cannot create facts.
- The worker accepts authenticated jobs and only supports `inspect` and `prepare` while `APPLICATION_MODE=PREPARE_ONLY`.
- CAPTCHA, MFA, legal declarations, salary, work authorization and unknown questions require human approval.
- Secrets belong in Vercel/Railway environment variables and must never be committed.
- Every page and API answer carries security headers (no framing, nosniff, HSTS, restricted permissions) and a
  Content-Security-Policy with a per-request nonce (`proxy.ts`, `lib/csp.ts`): only Next's own scripts run.
- Every signed-in API call counts against a per-account limit (`lib/api.ts`: 120/min, 6 searches/min, 30 AI
  calls/min, 10 worker or key tests/min) on top of the daily AI quotas.
- Platform data (source budgets, source health, offers catalogue, harvest) is written with the service client
  only; accounts cannot call those database functions.
- Every AI call's tokens are stored per account (`ai_usage`); Admin shows the estimated cost per account.
- GitHub Actions (`.github/workflows/ci.yml`) checks types, lint, tests and the build on every push.
