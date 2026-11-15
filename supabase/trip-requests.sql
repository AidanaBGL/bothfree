-- ============================================================
-- BothFree — trip join requests (addresses QA BF-04).
-- Run AFTER app-schema.sql + notifications.sql. The requester asks to join a
-- trip; the organizer (trip owner) accepts/declines. Both sides see one status,
-- and notifications are delivered server-side.
-- ============================================================

create table if not exists public.trip_requests (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade, -- requester
  to_user uuid not null references auth.users(id) on delete cascade,   -- organizer (set by trigger)
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (trip_id, from_user),
  check (from_user <> to_user)
);
create index if not exists trip_requests_parties on public.trip_requests (to_user, status);

alter table public.trip_requests enable row level security;

-- The owner is derived from the trip, never trusted from the client.
create or replace function public.set_trip_request_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select owner_id into new.to_user from public.trips where id = new.trip_id;
  if new.to_user is null then
    raise exception 'Trip not found';
  end if;
  if new.to_user = new.from_user then
    raise exception 'You cannot request to join your own trip';
  end if;
  return new;
end; $$;

drop trigger if exists trg_trip_request_owner on public.trip_requests;
create trigger trg_trip_request_owner
  before insert on public.trip_requests
  for each row execute function public.set_trip_request_owner();

drop policy if exists "see own trip requests" on public.trip_requests;
create policy "see own trip requests" on public.trip_requests
  for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "send trip requests" on public.trip_requests;
create policy "send trip requests" on public.trip_requests
  for insert to authenticated with check (auth.uid() = from_user);
drop policy if exists "respond trip requests" on public.trip_requests;
create policy "respond trip requests" on public.trip_requests
  for update to authenticated using (auth.uid() = to_user);

-- Notifications (reuses public.notifications + display_name from notifications.sql).
create or replace function public.notify_trip_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, object_type, object_id)
    values (new.to_user, 'trip_request', public.display_name(new.from_user) || ' wants to join your trip ✈️', 'trip', new.trip_id);
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'trip_accepted', public.display_name(new.to_user) || ' accepted you for the trip 🎉', 'trip', new.trip_id);
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'trip_declined', public.display_name(new.to_user) || ' can’t take you on this trip', 'trip', new.trip_id);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_trip_request on public.trip_requests;
create trigger trg_notify_trip_request
  after insert or update on public.trip_requests
  for each row execute function public.notify_trip_request();

do $$ begin
  alter publication supabase_realtime add table public.trip_requests;
exception when others then null; end $$;
