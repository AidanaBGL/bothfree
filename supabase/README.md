# BothFree — Supabase setup

Run these SQL files **in this exact order** in the Supabase SQL Editor
(Supabase → SQL Editor → New query → paste → Run). All are safe to re-run.

1. `app-schema.sql` — profiles, friend_requests, conversations, messages, plans, trips + RLS
2. `availability.sql` — availability_slots, blocks, `get_mutual_availability()` RPC
3. `security-hardening.sql` — moves PII out of profiles, friend-request transition guard, private invite plans
4. `notifications.sql` — notifications table + server-side notify triggers + realtime
5. `invite.sql` — `get_invite_plan(token)` RPC for the invite link
6. `trip-requests.sql` — join requests for trips
7. `plan-requests.sql` — join requests for plans ("I'm In")

## Do NOT run
- Anything under `_unused_spec_schema/` (the original README spec migrations and
  `seed.sql`). The running app does **not** use those tables — activities and
  NYC areas are hardcoded in `src/lib/reference/catalog.ts`. Running `seed.sql`
  fails with `relation "public.activities" does not exist`, which is expected
  and harmless — just skip it.

## Email sign-up (optional)
See `../SUPABASE_SETUP.md`: enable Email provider + Confirm email, use a
`{{ .Token }}` confirm-signup template, and (for delivery) custom SMTP.
