-- Baseline access control (§10). The `private` schema is never exposed to the
-- anon/authenticated roles directly; all client access goes through scoped RPC
-- (added in later migrations as the API surface lands). Public reference tables
-- are read-only to clients and RLS-guarded.

-- Lock down the private schema: revoke default access from client roles.
revoke all on schema private from anon, authenticated;
revoke all on all tables in private from anon, authenticated;
alter default privileges in schema private revoke all on tables from anon, authenticated;

-- Public reference data: readable by everyone, never writable by clients.
alter table public.activities enable row level security;
alter table public.cities enable row level security;
alter table public.venues enable row level security;

create policy activities_read on public.activities
  for select to anon, authenticated using (active);

create policy cities_read on public.cities
  for select to anon, authenticated using (true);

create policy venues_read on public.venues
  for select to anon, authenticated using (is_active);

-- NOTE: writes to reference tables are performed by the service-role client
-- only. The full per-table owner/membership/block policy matrix for exposed
-- projections is added alongside the RPC layer; an anonymous auth user carries
-- the `authenticated` role, so policies must additionally check is_anonymous,
-- capability, and demo room rather than role alone.
