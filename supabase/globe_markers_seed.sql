-- Seeds the bento globe markers into site_content. Idempotent — the ON
-- CONFLICT path leaves existing data alone on re-run, only inserting if
-- the key does not yet exist. Edit the JSON directly here only if you
-- want to reset to the seed values; otherwise use the inline-edit UI.
insert into public.site_content (key, value)
values (
  'bento.globe_markers',
  '[
    {"id":"00000000-0000-4000-8000-000000000001","city":"Boston","region":"MA","country":"USA","lat":42.3601,"lng":-71.0589,"timezone":"America/New_York","kind":"home"},
    {"id":"00000000-0000-4000-8000-000000000002","city":"West Lafayette","region":"IN","country":"USA","lat":40.4259,"lng":-86.9081,"timezone":"America/Indiana/Indianapolis","kind":"default"},
    {"id":"00000000-0000-4000-8000-000000000003","city":"San Francisco","region":"CA","country":"USA","lat":37.7749,"lng":-122.4194,"timezone":"America/Los_Angeles","kind":"current"}
  ]'::text
)
on conflict (key) do nothing;
