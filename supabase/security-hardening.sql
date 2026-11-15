-- ============================================================
-- BothFree — security hardening (addresses QA P0 BF-01, BF-02, BF-05).
-- Run in Supabase → SQL Editor AFTER app-schema.sql (and availability.sql).
-- Idempotent where practical.
-- ============================================================

-- ---- BF-01: keep PII out of the public profiles row ------------------
-- profiles is readable by all authenticated users (it's the discovery card),
-- so email / date_of_birth / gender must NOT live there. Move them to an
-- owner-only private table.
create table if not exists public.account_private (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  date_of_birth date,
  gender text,
  updated_at timestamptz not null default now()
);
alter table public.account_private enable row level security;

drop policy if exists "own private read" on public.account_private;
create policy "own private read" on public.account_private
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "own private write" on public.account_private;
create policy "own private write" on public.account_private
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Migrate any existing PII, then drop the columns from the public table.
-- Guarded so the script is safe to re-run after the columns are already gone.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) then
    insert into public.account_private (user_id, email, date_of_birth, gender)
    select id, email, date_of_birth, gender from public.profiles
    on conflict (user_id) do nothing;
  end if;
end $$;

alter table public.profiles drop column if exists email;
alter table public.profiles drop column if exists date_of_birth;
alter table public.profiles drop column if exists gender;

-- Recreate the signup trigger so private fields go to account_private.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;

  insert into public.account_private (user_id, email, date_of_birth, gender)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    new.raw_user_meta_data->>'gender'
  )
  on conflict (user_id) do nothing;

  update public.profiles
    set lgbtq_friendly = coalesce((new.raw_user_meta_data->>'lgbtq_friendly')::boolean, false)
    where id = new.id;
  return new;
end; $$;

-- ---- BF-02: constrain friend-request transitions ---------------------
-- Only the recipient may accept/decline a pending request; only the sender may
-- cancel their own pending request; from/to are immutable; no arbitrary status.
create or replace function public.enforce_friend_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.from_user <> old.from_user or new.to_user <> old.to_user then
    raise exception 'from_user/to_user are immutable';
  end if;
  if new.status = old.status then
    return new; -- no status change
  end if;
  if old.status <> 'pending' then
    raise exception 'Only pending requests can change status';
  end if;
  if new.status in ('accepted', 'declined') then
    if auth.uid() <> old.to_user then
      raise exception 'Only the recipient can accept or decline';
    end if;
  elsif new.status = 'cancelled' then
    if auth.uid() <> old.from_user then
      raise exception 'Only the sender can cancel';
    end if;
  else
    raise exception 'Invalid status transition';
  end if;
  return new;
end; $$;

-- allow 'cancelled' as a valid status value
alter table public.friend_requests drop constraint if exists friend_requests_status_check;
alter table public.friend_requests
  add constraint friend_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

drop trigger if exists friend_transition on public.friend_requests;
create trigger friend_transition
  before update on public.friend_requests
  for each row execute function public.enforce_friend_transition();

-- ---- BF-05: invite-mode plans are private ----------------------------
-- A plan created via "Invite someone I know" must not appear in the public feed;
-- only its owner can read it (the invitee uses the token link, handled in-app).
drop policy if exists "plans readable by authenticated" on public.plans;
create policy "plans readable by authenticated" on public.plans
  for select to authenticated
  using (owner_id = auth.uid() or coalesce(payload->>'mode', '') <> 'invite');
