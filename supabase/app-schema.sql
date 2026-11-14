-- ============================================================
-- BothFree — app schema for Supabase.
-- Paste this whole file into: Supabase → SQL Editor → New query → Run.
-- Safe to re-run (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ============================================================

-- 1. PROFILES (one row per auth user) --------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  date_of_birth date,
  gender text,
  city text default 'New York',
  bio text default '',
  area_id text,
  interests text[] not null default '{}',
  lgbtq_friendly boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles viewable by authenticated" on public.profiles;
create policy "profiles viewable by authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create a profile row when a user signs up (reads signUp metadata).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, email, date_of_birth, gender, lgbtq_friendly)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'date_of_birth', '')::date,
    new.raw_user_meta_data->>'gender',
    coalesce((new.raw_user_meta_data->>'lgbtq_friendly')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. FRIEND REQUESTS / FRIENDSHIPS -----------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (from_user, to_user),
  check (from_user <> to_user)
);
alter table public.friend_requests enable row level security;

drop policy if exists "see own friend requests" on public.friend_requests;
create policy "see own friend requests" on public.friend_requests
  for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);

drop policy if exists "send friend requests" on public.friend_requests;
create policy "send friend requests" on public.friend_requests
  for insert to authenticated with check (auth.uid() = from_user);

drop policy if exists "respond to friend requests" on public.friend_requests;
create policy "respond to friend requests" on public.friend_requests
  for update to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

-- 3. CONVERSATIONS + MESSAGES ----------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;

drop policy if exists "see own conversations" on public.conversations;
create policy "see own conversations" on public.conversations
  for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "create conversations" on public.conversations;
create policy "create conversations" on public.conversations
  for insert to authenticated with check (auth.uid() = user_a or auth.uid() = user_b);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;

-- Is the current user a participant in a given conversation?
create or replace function public.in_conversation(conv uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.conversations c
    where c.id = conv and (c.user_a = auth.uid() or c.user_b = auth.uid())
  );
$$;

drop policy if exists "read messages in own conversations" on public.messages;
create policy "read messages in own conversations" on public.messages
  for select to authenticated using (public.in_conversation(conversation_id));

drop policy if exists "send messages in own conversations" on public.messages;
create policy "send messages in own conversations" on public.messages
  for insert to authenticated with check (sender = auth.uid() and public.in_conversation(conversation_id));

-- 4. PLANS + TRIPS (public feed, owner-managed) ----------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.plans enable row level security;
drop policy if exists "plans readable by authenticated" on public.plans;
create policy "plans readable by authenticated" on public.plans for select to authenticated using (true);
drop policy if exists "owners manage their plans" on public.plans;
create policy "owners manage their plans" on public.plans for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.trips enable row level security;
drop policy if exists "trips readable by authenticated" on public.trips;
create policy "trips readable by authenticated" on public.trips for select to authenticated using (true);
drop policy if exists "owners manage their trips" on public.trips;
create policy "owners manage their trips" on public.trips for all to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- 5. REALTIME for messages (optional convenience) --------------------
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when others then
  null; -- already added, or publication managed in dashboard
end $$;
