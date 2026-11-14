-- An AI-written summary of one visit (what they did, what they seemed to want), generated on demand from the dashboard.
alter table public.visits add column if not exists story text;
alter table public.visits add column if not exists story_at timestamptz;
