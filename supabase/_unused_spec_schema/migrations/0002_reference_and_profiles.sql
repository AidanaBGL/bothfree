-- Reference catalogs (§9.2) and profile / identity tables.

-- Public reference data: readable by everyone, writable by admin only (via grants).
create table public.activities (
  id text primary key,
  code text not null unique,
  label text not null,
  active boolean not null default true
);

create table public.cities (
  id text primary key,
  name text not null,
  country text not null,
  timezone text not null,
  boundary geometry(MultiPolygon, 4326)
);

-- Private, never exposed directly to clients.
create table private.account_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date not null,
  phone_e164 text,
  phone_verified_at timestamptz,
  country text,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  constraint dob_not_future check (date_of_birth <= current_date)
);

create table private.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  room_id uuid not null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text check (char_length(bio) <= 500),
  city_id text references public.cities(id),
  friendship_enabled boolean not null default false,
  dating_enabled boolean not null default false,
  discovery_status private.profile_status not null default 'draft',
  paused_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table private.profile_identity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender_codes text[] not null default '{}',
  gender_custom text check (char_length(gender_custom) <= 60),
  pronouns text,
  orientation_codes text[] not null default '{}',
  show_gender boolean not null default false,
  show_pronouns boolean not null default false,
  show_orientation boolean not null default false,
  discovery_gender_tags text[] not null default '{}',
  -- "prefer_not_to_say" is mutually exclusive with any other gender value.
  constraint gender_pnts_exclusive check (
    not ('prefer_not_to_say' = any(gender_codes)) or array_length(gender_codes, 1) = 1
  )
);

create table private.dating_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  min_age int not null default 18,
  max_age int not null default 99,
  accepted_gender_tags text[] not null default '{}',
  accepts_everyone boolean not null default false,
  accepts_custom_identities boolean not null default false,
  constraint min_age_adult check (min_age >= 18),
  constraint age_order check (max_age >= min_age)
);

create table private.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  sort_order int not null,
  moderation_status private.moderation_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, sort_order)
);

create table private.profile_interests (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id text not null references public.activities(id),
  primary key (user_id, activity_id)
);
