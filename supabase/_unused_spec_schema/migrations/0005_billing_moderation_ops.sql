-- Subscription, moderation, notifications, and operational tables (§9.6).

create table private.billing_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique
);

create table private.subscriptions (
  stripe_subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  price_id text not null,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  synced_at timestamptz not null default now()
);

create table private.billing_events (
  stripe_event_id text primary key,
  status private.moderation_status not null default 'pending',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_code text
);

create table private.entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_code text not null,
  valid_until timestamptz,
  source text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, feature_code, source)
);

create table private.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint block_not_self check (blocker_id <> blocked_id)
);

create table private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references private.plans(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'open',
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table private.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  subject_id uuid not null references auth.users(id),
  action text not null,
  reason text,
  created_at timestamptz not null default now()
);

create table private.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  object_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Transactional outbox for reliable, deduplicated side effects.
create table private.outbox (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  kind text not null,
  payload_minimal jsonb not null default '{}'::jsonb,
  status private.moderation_status not null default 'pending',
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now()
);

create table private.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  request_id text,
  created_at timestamptz not null default now()
);

create table private.rate_limit_buckets (
  key_hash bytea not null,
  window_start timestamptz not null,
  count int not null default 0,
  expires_at timestamptz not null,
  primary key (key_hash, window_start)
);
