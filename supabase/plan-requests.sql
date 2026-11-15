-- ============================================================
-- BothFree — plan join requests (fixes the "I'm In" cross-account bug).
-- Run AFTER app-schema.sql + notifications.sql. B taps "I'm In" on A's plan →
-- a real DB request is created; A (owner) sees it, accepts/declines; both sides
-- get notifications and a persisted status.
-- ============================================================

create table if not exists public.plan_requests (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade, -- requester (B)
  to_user uuid not null references auth.users(id) on delete cascade,   -- owner (A), set by trigger
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (plan_id, from_user),
  check (from_user <> to_user)
);
create index if not exists plan_requests_parties on public.plan_requests (to_user, status);

alter table public.plan_requests enable row level security;

-- Owner is derived from the plan server-side, never trusted from the client.
create or replace function public.set_plan_request_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select owner_id into new.to_user from public.plans where id = new.plan_id;
  if new.to_user is null then
    raise exception 'Plan not found';
  end if;
  if new.to_user = new.from_user then
    raise exception 'You cannot request to join your own plan';
  end if;
  return new;
end; $$;

drop trigger if exists trg_plan_request_owner on public.plan_requests;
create trigger trg_plan_request_owner
  before insert on public.plan_requests
  for each row execute function public.set_plan_request_owner();

drop policy if exists "see own plan requests" on public.plan_requests;
create policy "see own plan requests" on public.plan_requests
  for select to authenticated using (auth.uid() = from_user or auth.uid() = to_user);
drop policy if exists "send plan requests" on public.plan_requests;
create policy "send plan requests" on public.plan_requests
  for insert to authenticated with check (auth.uid() = from_user);
drop policy if exists "respond plan requests" on public.plan_requests;
create policy "respond plan requests" on public.plan_requests
  for update to authenticated using (auth.uid() = to_user);

-- Notifications (reuses public.notifications + display_name from notifications.sql).
create or replace function public.notify_plan_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, object_type, object_id)
    values (new.to_user, 'plan_request', public.display_name(new.from_user) || ' wants to join your plan', 'plan', new.plan_id);
  elsif tg_op = 'UPDATE' and new.status <> old.status then
    if new.status = 'accepted' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'plan_accepted', public.display_name(new.to_user) || ' accepted you — you’re in! 🎉', 'plan', new.plan_id);
    elsif new.status = 'declined' then
      insert into public.notifications (user_id, kind, title, object_type, object_id)
      values (new.from_user, 'plan_declined', public.display_name(new.to_user) || ' can’t make this one', 'plan', new.plan_id);
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_notify_plan_request on public.plan_requests;
create trigger trg_notify_plan_request
  after insert or update on public.plan_requests
  for each row execute function public.notify_plan_request();

do $$ begin
  alter publication supabase_realtime add table public.plan_requests;
exception when others then null; end $$;
