-- ============================================================
-- BothFree — Smart matching calendar.
-- Run in Supabase → SQL Editor AFTER app-schema.sql. Safe to re-run.
-- Provides: availability_slots, blocks, meeting_proposals, and a secure
-- get_mutual_availability() RPC that only ever returns the OVERLAP — never a
-- user's full schedule.
-- ============================================================

-- 1. Availability slots ------------------------------------------------
create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint slot_order check (ends_at > starts_at)
);
create index if not exists availability_user_time on public.availability_slots (user_id, starts_at);

alter table public.availability_slots enable row level security;

-- Owner-only: a user can read/insert/delete ONLY their own slots. Nobody can
-- read anyone else's raw availability through the API.
drop policy if exists "own slots select" on public.availability_slots;
create policy "own slots select" on public.availability_slots
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own slots insert" on public.availability_slots;
create policy "own slots insert" on public.availability_slots
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "own slots delete" on public.availability_slots;
create policy "own slots delete" on public.availability_slots
  for delete to authenticated using (auth.uid() = user_id);

-- 2. Blocks ------------------------------------------------------------
create table if not exists public.blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "see own blocks" on public.blocks;
create policy "see own blocks" on public.blocks for select to authenticated using (auth.uid() = blocker);
drop policy if exists "manage own blocks" on public.blocks;
create policy "manage own blocks" on public.blocks for all to authenticated
  using (auth.uid() = blocker) with check (auth.uid() = blocker);

-- 3. Interaction guard -------------------------------------------------
-- Two users may see each other's mutual availability only if they are accepted
-- friends and neither has blocked the other.
create or replace function public.can_interact(a uuid, b uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select
    exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.from_user = a and fr.to_user = b) or (fr.from_user = b and fr.to_user = a))
    )
    and not exists (
      select 1 from public.blocks bl
      where (bl.blocker = a and bl.blocked = b) or (bl.blocker = b and bl.blocked = a)
    );
$$;

-- 4. Secure mutual-availability RPC -----------------------------------
-- Returns at most 3 overlapping intervals (>= 60 min) in the next 14 days,
-- ordered by soonest date then longest duration. SECURITY DEFINER so it can read
-- both users' slots, but it checks the caller's identity + interaction rights
-- first and NEVER exposes raw rows — only the computed overlap.
create or replace function public.get_mutual_availability(other_user_id uuid)
returns table (starts_at timestamptz, ends_at timestamptz, minutes int)
language plpgsql security definer set search_path = public stable as $$
declare
  me uuid := auth.uid();
  horizon timestamptz := now() + interval '14 days';
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = other_user_id then
    raise exception 'Cannot match with yourself';
  end if;
  if not public.can_interact(me, other_user_id) then
    -- No permission → behave as "no matches", never leak the schedule.
    return;
  end if;

  return query
  with a as (
    select s.starts_at, s.ends_at from public.availability_slots s
    where s.user_id = me and s.ends_at > now() and s.starts_at < horizon
  ),
  b as (
    select s.starts_at, s.ends_at from public.availability_slots s
    where s.user_id = other_user_id and s.ends_at > now() and s.starts_at < horizon
  ),
  common as (
    select
      greatest(a.starts_at, b.starts_at) as s,
      least(a.ends_at, b.ends_at) as e
    from a join b
      on a.starts_at < b.ends_at and b.starts_at < a.ends_at
  )
  select o.s, o.e, (extract(epoch from (o.e - o.s)) / 60)::int
  from common o
  where extract(epoch from (o.e - o.s)) >= 3600  -- >= 60 minutes
  order by o.s asc, (o.e - o.s) desc
  limit 3;
end; $$;

grant execute on function public.get_mutual_availability(uuid) to authenticated;

-- 5. Meeting proposals -------------------------------------------------
create table if not exists public.meeting_proposals (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  activity text,
  place text,
  details text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint proposal_order check (ends_at > starts_at),
  check (from_user <> to_user)
);
create index if not exists proposals_parties on public.meeting_proposals (from_user, to_user);
-- No duplicate pending proposal for the same slot.
create unique index if not exists proposals_no_dupe
  on public.meeting_proposals (from_user, to_user, starts_at)
  where status = 'pending';

alter table public.meeting_proposals enable row level security;
drop policy if exists "see own proposals" on public.meeting_proposals;
create policy "see own proposals" on public.meeting_proposals
  for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "send proposals" on public.meeting_proposals;
create policy "send proposals" on public.meeting_proposals
  for insert to authenticated with check (auth.uid() = from_user and public.can_interact(auth.uid(), to_user));
drop policy if exists "respond proposals" on public.meeting_proposals;
create policy "respond proposals" on public.meeting_proposals
  for update to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

-- 6. Realtime ----------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.meeting_proposals;
exception when others then null; end $$;
