-- BothFree core: extensions, schemas, and enums (§9).
-- Conventions: UUID PKs, timestamptz with server-set creation time, money as
-- integer US cents, geometry SRID 4326.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";
create extension if not exists "btree_gist";

-- `private` holds non-exposed application tables; access is via scoped RPC and
-- schema grants. `public` holds reference data and RLS-guarded projections.
create schema if not exists private;

-- Enums fix the allowed states so bad values cannot be inserted.
create type private.meeting_mode as enum ('invite', 'friendship', 'dating');
create type private.bill_preference as enum ('each_pays_own', 'split_evenly', 'i_treat', 'needs_discussion');
create type private.request_status as enum ('draft', 'active', 'paused', 'expired', 'archived');
create type private.invitation_status as enum ('open', 'full', 'expired', 'revoked');
create type private.match_status as enum ('active', 'closed', 'blocked');
create type private.plan_status as enum ('collecting', 'proposed', 'awaiting_confirmation', 'confirmed', 'completed', 'cancelled', 'expired');
create type private.proposal_status as enum ('current', 'superseded', 'expired');
create type private.like_decision as enum ('like', 'pass');
create type private.profile_status as enum ('draft', 'active', 'paused', 'suspended');
create type private.participation_status as enum ('invited', 'active', 'declined', 'left');
create type private.moderation_status as enum ('pending', 'processed', 'failed');
