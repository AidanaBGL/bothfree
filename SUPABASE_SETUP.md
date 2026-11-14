# Connecting BothFree to Supabase

Until you do this, the app runs as a local demo (no real accounts). Once the
env vars are set, **Log In / Sign Up** use real Supabase Auth with a 6-digit
email code. "Jury Access" and "Explore as User" stay no-account demo paths.

## 1. Create the project
1. Go to <https://supabase.com> → **New project**. Pick a name + database password, wait for it to provision.

## 2. Get your keys
2. In the project: **Project Settings → API**.
   - Copy **Project URL**.
   - Copy the **anon / publishable** key (public). *Do not* use the service_role key in the app.

## 3. Add them to the app
Create `.env.local` in the repo root (it is gitignored):

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
```

## 4. Create the tables
4. In Supabase: **SQL Editor → New query** → paste all of
   [`supabase/app-schema.sql`](supabase/app-schema.sql) → **Run**.
   This creates `profiles`, `friend_requests`, `conversations`, `messages`,
   `plans`, `trips`, all with row-level security, plus a trigger that creates a
   profile row on signup.

## 5. Turn on email signup + a 6-digit code
5. **Authentication → Providers → Email**: enable it, and turn **Confirm email** ON.
6. **Authentication → Email Templates → "Confirm signup"**: replace the body so
   users get a **code** instead of a magic link. Example:

   ```html
   <h2>Confirm your BothFree account</h2>
   <p>Your verification code is:</p>
   <h1>{{ .Token }}</h1>
   ```

   (`{{ .Token }}` is the 6-digit code our verify screen asks for.)

## 6. Run it
```bash
npm install
npm run dev
```
Open <http://localhost:3000/demo> → **Sign Up** → enter a real email → you'll get
a code → type it on the verify screen → you're in. Next time, use **Log In**.

## Notes
- Local dev uses Supabase's built-in email sender (rate-limited). For production
  volume, set up SMTP (e.g. Resend) under **Authentication → Emails → SMTP** and
  send from a verified domain.
- The app reads `NEXT_PUBLIC_*` keys in the browser — only the public key goes
  there. Keep the service_role key server-side only (it's in `.env.example` for
  future server jobs, not used by the client).
