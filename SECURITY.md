# Security model

- The browser receives only the Supabase publishable key; the service-role key is never used by the dashboard.
- Every public table must keep RLS enabled with ownership policies based on `auth.uid() = user_id`.
- Gemini receives only the job text and verified profile facts; it cannot create facts.
- The worker accepts authenticated jobs and only supports `inspect` and `prepare` while `APPLICATION_MODE=PREPARE_ONLY`.
- CAPTCHA, MFA, legal declarations, salary, work authorization and unknown questions require human approval.
- Secrets belong in Vercel/Railway environment variables and must never be committed.
