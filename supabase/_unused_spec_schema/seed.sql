-- Reference seed data only. Contains NO personal data, profiles, or demo users.

insert into public.activities (id, code, label, active) values
  ('coffee',   'coffee',   'Coffee & chat',  true),
  ('food',     'food',     'Food & drinks',  true),
  ('walk',     'walk',     'Walk outside',   true),
  ('arts',     'arts',     'Arts & culture', true),
  ('games',    'games',    'Games & fun',    true),
  ('wellness', 'wellness', 'Wellness',       true),
  ('music',    'music',    'Live music',     true),
  ('surprise', 'surprise', 'Surprise me',    true)
on conflict (id) do nothing;

-- Launch city. Boundary is left null here; load an authoritative MultiPolygon
-- via a geodata import rather than hand-coding coordinates.
insert into public.cities (id, name, country, timezone) values
  ('new-york', 'New York', 'US', 'America/New_York')
on conflict (id) do nothing;
