-- Discovery, matches, plans, proposals, and bookings (§9.5).

create table private.likes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  mode private.meeting_mode not null,
  decision private.like_decision not null,
  created_at timestamptz not null default now(),
  constraint like_not_self check (from_user_id <> to_user_id),
  unique (room_id, from_user_id, to_user_id, mode)
);
create index likes_to_user on private.likes (to_user_id, mode);

create table private.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  mode private.meeting_mode not null,
  status private.match_status not null default 'active',
  created_at timestamptz not null default now(),
  constraint match_order check (user_low_id < user_high_id),
  unique (room_id, user_low_id, user_high_id, mode)
);

create table private.plans (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  match_id uuid references private.matches(id) on delete cascade,
  invitation_id uuid references private.invitations(id) on delete cascade,
  status private.plan_status not null default 'collecting',
  version int not null default 1,
  selected_proposal_id uuid,
  created_at timestamptz not null default now(),
  -- Exactly one source: a match or an invitation.
  constraint plan_single_source check (
    (match_id is not null and invitation_id is null) or
    (match_id is null and invitation_id is not null)
  )
);

create table private.plan_members (
  plan_id uuid not null references private.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  participation_status private.participation_status not null default 'invited',
  primary key (plan_id, user_id)
);

create table private.plan_proposals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references private.plans(id) on delete cascade,
  version int not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null,
  activity_id text references public.activities(id),
  common_area geometry(MultiPolygon, 4326),
  budget_ceiling_cents int not null,
  bill_status text not null,
  venue_id uuid,
  status private.proposal_status not null default 'current',
  expires_at timestamptz,
  input_versions jsonb not null default '{}'::jsonb,
  constraint proposal_order check (starts_at < ends_at)
);
create index plan_proposals_plan on private.plan_proposals (plan_id, version);

create table private.plan_acceptances (
  plan_id uuid not null references private.plans(id) on delete cascade,
  proposal_id uuid not null references private.plan_proposals(id) on delete cascade,
  proposal_version int not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  accepted_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

create table private.messages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references private.plans(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index messages_plan_created on private.messages (plan_id, created_at);

-- Internal busy ranges in BothFree (not venue reservations). The exclusion
-- constraint prevents a single user confirming two overlapping active plans.
create table private.confirmed_bookings (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references private.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  busy_range tstzrange not null,
  released_at timestamptz,
  exclude using gist (
    user_id with =,
    busy_range with &&
  ) where (released_at is null)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  city_id text references public.cities(id),
  name text not null,
  point geography(Point, 4326) not null,
  activity_id text references public.activities(id),
  estimated_cost_cents int,
  source_url text,
  checked_at timestamptz,
  is_active boolean not null default true
);
create index venues_point_gix on public.venues using gist (point);
