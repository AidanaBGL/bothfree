-- ============================================================
-- BothFree — invite link resolver (addresses QA BF-08).
-- Run in Supabase → SQL Editor AFTER app-schema.sql + security-hardening.sql.
-- Invite-mode plans are private (RLS hides them from non-owners), so a holder of
-- the secret token resolves the plan through this SECURITY DEFINER function,
-- which returns only the plan's public payload — nothing else.
-- ============================================================

create or replace function public.get_invite_plan(token text)
returns jsonb language sql security definer set search_path = public stable as $$
  select p.payload
  from public.plans p
  where coalesce(p.payload->>'mode', '') = 'invite'
    and p.payload->>'inviteToken' = token
  limit 1;
$$;

-- Anyone with the link can look it up (the token is the secret).
grant execute on function public.get_invite_plan(text) to anon, authenticated;
