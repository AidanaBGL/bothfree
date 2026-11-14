# BothFree — build status

This repo now contains a **runnable scaffold** of the product specified in
`README.md`, following that document's target structure (§8), data model (§9),
and matching algorithm (§11). The README remains the source of truth for the
full product; this file tracks what is actually implemented.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm test               # 25 unit tests (matching engine, timezone, ics)
npm run typecheck
npm run build
```

No environment variables are required to run the landing page, the interactive
`/demo`, and the health endpoints. Supabase/Stripe keys (see `.env.example`)
are only needed once the persistence and auth layers are wired.

## Implemented

- **Project + deploy config:** `package.json`, `tsconfig.json`, `next.config.ts`,
  `Dockerfile`, `railway.json`, `.env.example`, `.gitignore`, `vitest.config.ts`.
- **Deterministic matching engine** (`src/lib/matching/`) — the graded core,
  fully unit-tested:
  - `time.ts` — merge / subtract / intersect half-open UTC windows; 30-minute
    slot enumeration (no silent shortening of duration).
  - `geo.ts` — bbox overlap pre-filter + point-in-polygon (authoritative area
    intersection is deferred to PostGIS `ST_Intersection`, per §11.3).
  - `budget.ts` — common band (`min` ceiling / `max` floor), `0` = free, bill
    compatibility.
  - `proposals.ts` — hard filters in spec order, up to 3 stable-ranked options.
  - `rank.ts` — transparent candidate ordering (no opaque score).
- **Timezone conversion** (`src/lib/validation/timezone.ts`) — local + IANA → UTC
  via `Intl`, DST-correct, rejects non-existent local times.
- **Calendar export** (`src/lib/calendar/ics.ts`) — RFC 5545 VEVENT with CRLF,
  SEQUENCE, escaping, and no private fields.
- **Supabase schema** (`supabase/migrations/0001`–`0006`) — extensions, enums,
  profiles/identity, requests/availability/areas, invitations/guest access,
  discovery/matches/plans/proposals/bookings (with the `btree_gist` exclusion
  constraint), billing/moderation/ops tables, baseline RLS/grants. `seed.sql`
  has reference activities + NYC only (no personal data).
- **App shell** — landing page and `/premium` (ported from the approved
  prototype design), `/api/health`, `/api/ready`.
- **No-login demo** — a working slice of the real product loop:
  - **Jury test login** (`/demo`) — pre-placed test credentials, one tap to
    enter (spec §15 one-tap account), persisted to `localStorage`.
  - **Airline-style month calendar** (`src/components/MonthCalendar.tsx`) —
    month navigation, arbitrary day selection, and a range-fill mode for several
    consecutive days.
  - **Custom activities** — add free-text activities alongside the preset 8.
  - **Discovery feed** (`POST /api/v1/demo/feed`) — scrollable people cards for 6
    seeded profiles, each scored by the **real** engine (shared time, activities,
    area, budget), feasible plans ranked first. Like / Pass / Send match.
  - **Notification center** — bell with unread count; a mutual (`likesYouBack`)
    profile produces an "It's a match" notification.
  - Also `POST /api/v1/demo/match` (single-counterpart) is kept. Success,
    empty-reason, and validation paths all verified against the running server.
- **Supabase clients** (`src/lib/supabase/{browser,server,admin}.ts`) and the
  standard API error envelope (`src/lib/http/errors.ts`).

## Not yet implemented (next stages, per README §20)

1. **Auth + profiles** — signup/verify/login routes, `account_details` /
   `profiles` persistence, 18+ gate, inclusive gender form.
2. **Request persistence + RPC layer** — write the matching inputs to Postgres;
   move area intersection into PostGIS RPC; full per-table RLS policy matrix.
3. **Real two-party flow** — invitations (secret-link redeem), discovery, likes,
   mutual match, plan proposals, and the transactional `accept_proposal`
   (row-lock + exclusion-constraint race protection from §12.2).
4. **Billing** — Stripe checkout/portal/webhook with server-verified
   entitlements; `BILLING_ENABLED` / Test mode handling.
5. **Safety** — blocks, reports, moderation actions; rate limiting; CSRF/Origin
   checks; Storage policies for `profile-photos`.
6. **Demo room isolation** — anonymous auth sessions, demo room lifecycle,
   cleanup job (`scripts/cleanup-demo.ts`).
7. **E2E tests** (Playwright) and integration/security tests from §21.

The migration order and table shapes already match these next stages, so each
one slots into the existing structure without reshaping what is here.
