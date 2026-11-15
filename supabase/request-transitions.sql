-- ============================================================
-- BothFree — strict status transitions for plan/trip requests (QA Stage 2).
-- Run AFTER plan-requests.sql + trip-requests.sql. Safe to re-run.
-- Enforces: only the organizer accepts/declines a PENDING request; only the
-- requester cancels their own PENDING request; plan/trip/from/to are immutable;
-- a resolved request can't be changed again.
-- ============================================================

-- Allow the "cancelled" status.
alter table public.plan_requests drop constraint if exists plan_requests_status_check;
alter table public.plan_requests
  add constraint plan_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

alter table public.trip_requests drop constraint if exists trip_requests_status_check;
alter table public.trip_requests
  add constraint trip_requests_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled'));

-- Let the requester update too (for cancel); the trigger enforces who-can-do-what.
drop policy if exists "respond plan requests" on public.plan_requests;
create policy "respond plan requests" on public.plan_requests
  for update to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

drop policy if exists "respond trip requests" on public.trip_requests;
create policy "respond trip requests" on public.trip_requests
  for update to authenticated using (auth.uid() = to_user or auth.uid() = from_user);

-- Shared transition guard (works for both tables via NEW/OLD columns).
create or replace function public.enforce_request_transition()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.from_user <> old.from_user or new.to_user <> old.to_user then
    raise exception 'from_user/to_user are immutable';
  end if;
  if (tg_table_name = 'plan_requests' and new.plan_id <> old.plan_id)
     or (tg_table_name = 'trip_requests' and new.trip_id <> old.trip_id) then
    raise exception 'request target is immutable';
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status <> 'pending' then
    raise exception 'Only a pending request can change status';
  end if;
  if new.status in ('accepted', 'declined') then
    if auth.uid() <> old.to_user then
      raise exception 'Only the organizer can accept or decline';
    end if;
  elsif new.status = 'cancelled' then
    if auth.uid() <> old.from_user then
      raise exception 'Only the requester can cancel';
    end if;
  else
    raise exception 'Invalid status transition';
  end if;
  return new;
end; $$;

drop trigger if exists trg_plan_request_transition on public.plan_requests;
create trigger trg_plan_request_transition
  before update on public.plan_requests
  for each row execute function public.enforce_request_transition();

drop trigger if exists trg_trip_request_transition on public.trip_requests;
create trigger trg_trip_request_transition
  before update on public.trip_requests
  for each row execute function public.enforce_request_transition();
