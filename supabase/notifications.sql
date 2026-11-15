-- ============================================================
-- BothFree — persistent notifications (addresses QA BF-07).
-- Run in Supabase → SQL Editor AFTER app-schema.sql + availability.sql.
-- Notifications are written ONLY by SECURITY DEFINER triggers (never by the
-- client), delivered to the recipient, readable only by them, and real-time.
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- recipient
  kind text not null,
  title text not null,
  object_type text,
  object_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Recipient can read and mark-as-read their own notifications. No client insert.
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "update own notifications" on public.notifications;
create policy "update own notifications" on public.notifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Helper: display name for a user id.
create or replace function public.display_name(uid uuid)
returns text language sql security definer set search_path = public stable as $$
  select coalesce(nullif(name, ''), 'Someone') from public.profiles where id = uid;
$$;

-- Friend-request notifications.
create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, object_type, object_id)
    values (new.to_user, 'friend_request', public.display_name(new.from_user) || ' sent you a friend request', 'friend_request', new.id);
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status <> 'accepted' then
    insert into public.notifications (user_id, kind, title, object_type, object_id)
    values (new.from_user, 'friend_accepted', public.display_name(new.to_user) || ' accepted your friend request', 'friend_request', new.id);
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_friend_request on public.friend_requests;
create trigger trg_notify_friend_request
  after insert or update on public.friend_requests
  for each row execute function public.notify_friend_request();

-- Meeting-proposal notifications.
create or replace function public.notify_meeting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, object_type, object_id)
    values (new.to_user, 'meeting_proposed', public.display_name(new.from_user) || ' proposed a meeting', 'meeting', new.id);
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'meeting_confirmed', public.display_name(new.to_user) || ' confirmed your meeting 🎉', 'meeting', new.id);
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'meeting_declined', public.display_name(new.to_user) || ' can’t make that time', 'meeting', new.id);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_meeting on public.meeting_proposals;
create trigger trg_notify_meeting
  after insert or update on public.meeting_proposals
  for each row execute function public.notify_meeting();

-- Realtime.
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null; end $$;
