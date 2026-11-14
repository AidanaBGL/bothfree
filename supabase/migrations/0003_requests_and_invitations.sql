-- Per-search preferences (§9.3) and invitation / guest access (§9.4).

create table private.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  mode private.meeting_mode not null,
  status private.request_status not null default 'draft',
  date_from date not null,
  date_to date not null,
  timezone text not null,
  duration_minutes int not null,
  buffer_minutes int not null default 0,
  city_id text references public.cities(id),
  min_budget_cents int not null default 0,
  max_budget_cents int not null default 0,
  bill_preference private.bill_preference not null default 'each_pays_own',
  preference_version int not null default 1,
  created_at timestamptz not null default now(),
  constraint budget_order check (max_budget_cents >= min_budget_cents and min_budget_cents >= 0),
  constraint date_order check (date_to >= date_from),
  constraint period_max_14_days check (date_to - date_from <= 14),
  constraint duration_allowlist check (duration_minutes in (30, 45, 60, 90, 120, 180))
);

-- One active request per (user, mode, room) in the MVP.
create unique index meeting_requests_one_active
  on private.meeting_requests (room_id, owner_id, mode)
  where status = 'active';

create table private.availability_windows (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references private.meeting_requests(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  constraint window_order check (starts_at < ends_at)
);
create index availability_windows_request on private.availability_windows (request_id);

create table private.request_activities (
  request_id uuid not null references private.meeting_requests(id) on delete cascade,
  activity_id text not null references public.activities(id),
  primary key (request_id, activity_id)
);

create table private.request_areas (
  request_id uuid primary key references private.meeting_requests(id) on delete cascade,
  area geometry(MultiPolygon, 4326) not null,
  source text,
  area_label text,
  constraint area_valid check (ST_IsValid(area))
);
create index request_areas_gix on private.request_areas using gist (area);

create table private.invitations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid references private.meeting_requests(id) on delete set null,
  token_hash bytea not null unique,
  max_guests int not null check (max_guests between 1 and 7),
  status private.invitation_status not null default 'open',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  title text,
  created_at timestamptz not null default now()
);

create table private.invitation_members (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references private.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'guest')),
  guest_request_id uuid references private.meeting_requests(id) on delete set null,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (invitation_id, user_id)
);

create table private.guest_capabilities (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references private.invitations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_hash bytea not null,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table private.demo_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_session_id text not null,
  join_token_hash bytea not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
