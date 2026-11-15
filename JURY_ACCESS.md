# Jury access & demo guide

No sign-up needed. On the welcome screen, use one of the two one-tap demo entries.

## Two one-tap identities (REAL accounts that sync across devices)

| Button | Signs you in as | Email |
| --- | --- | --- |
| **Jury Access** | **Alia** | `jury@bothfree.app` |
| **Explore as User** | **Madina** | `demo@bothfree.app` |

These two buttons now sign into **real Supabase accounts** (created automatically
the first time), so their actions — plan requests, meetings, notifications —
really sync between two different browsers/devices and persist after reload.

### One-time setup for the real accounts
Because they're real accounts, Supabase email settings apply:
- Easiest: in Supabase → **Authentication → Providers → Email**, turn **“Confirm
  email” OFF**. Then the two buttons just work (account auto-created on first tap).
- Or create the two accounts once via **Sign Up** (emails above) and confirm them.

If Supabase isn't reachable, the buttons fall back to a local-only demo persona
(no cross-device sync).

## Show a real cross-account match (2 windows)
1. Open the site in **two browser windows** (e.g. normal + incognito).
2. Window 1 → **Jury Access** (you are **Alia**).
3. Window 2 → **Explore as User** (you are **Madina**).
4. In either window, open **Discover**. Alia sees Madina's card (and vice-versa).
5. Tap **“I’m in →”** on the other person's plan.
   - Because they like you back, you get **“It’s a match!”** and a **Meeting** is proposed.
6. Open **Meetings** → the match becomes a real meeting you both confirm
   (confirm / reschedule / cancel, with reminders and an .ics calendar export).

You can also post a plan in one window and watch the **Match request** appear in
the other window's Discover (top of the feed) — accept it there.

## Invite someone you know (private link, not the feed)
- **+ New plan → “Invite someone I know”** → finish the steps → you get a
  **private invite link** (`/invite/…`) in a popup. This is **not** posted to the
  public feed — it's meant to be shared directly with one person.

## Other things to try
- **Travel** → post a trip; matching trips show a real date-overlap badge.
- **Friends** → open a profile from a plan card (click the name/avatar) → Add Friend.
- **Spark ✨** (Premium) → 50 conversation cards. Toggle **Premium** in the sidebar.
- **Messages** → chat with a friend / mutual match.

Note: the one-tap Jury/Demo entries run on seeded demo data. Real **Log In / Sign
Up** accounts use live Supabase storage (plans, friends, messages persist and
sync between accounts).
