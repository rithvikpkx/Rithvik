-- First-party visitor tracking: visitors, visits, events, session replays, IP enrichment cache.
-- Additive and idempotent. Every table is service-role only (RLS on, NO policies): the app reaches
-- them through adminClient() in app/api/t/*, lib/track/* and the /admin/visitors pages.
-- Disclosed on /privacy. Retention: tracking_prune() (visits/events 400 days, replays 90 days).

-- One row per browser (id = the 1-year `rv_id` cookie value).
create table if not exists public.visitors (
  id               uuid primary key,
  first_seen       timestamptz not null default now(),
  last_seen        timestamptz not null default now(),
  first_ip         text,
  last_ip          text,
  ips              text[] not null default '{}',
  company          text,          -- inferred from the IP (ip_enrichment), or what the visitor said
  org              text,          -- network owner, e.g. "Google LLC"
  asn              text,
  ip_type          text check (ip_type in ('business', 'isp', 'hosting', 'edu')),
  city             text,
  region           text,
  country          text,
  timezone         text,
  languages        text,
  user_agent       text,
  browser          text,
  os               text,
  device           text,          -- desktop | mobile | tablet
  screen           text,          -- "1440x900@2"
  first_referrer   text,
  first_utm        jsonb,
  email            text,          -- set by identifyVisitor() when they give one
  name             text,
  company_given    text,
  visits           int not null default 0,
  identified_at    timestamptz,
  is_bot           boolean not null default false
);
create index if not exists visitors_last_seen_idx  on public.visitors (last_seen desc);
create index if not exists visitors_email_idx      on public.visitors (email) where email is not null;
create index if not exists visitors_company_idx    on public.visitors (lower(company)) where company is not null;

-- One row per page session (the id lives in the tab's sessionStorage).
create table if not exists public.visits (
  id          uuid primary key,
  visitor_id  uuid not null references public.visitors(id) on delete cascade,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz not null default now(),
  ip          text,
  entry_url   text,
  referrer    text,
  utm         jsonb,
  design      text,
  viewport    text,
  tz          text,
  lang        text,
  is_bot      boolean not null default false
);
create index if not exists visits_visitor_idx on public.visits (visitor_id, started_at desc);
create index if not exists visits_started_idx on public.visits (started_at desc);

-- The event stream: pageview, click, section, scroll, ... (types validated in lib/track/schema.ts).
create table if not exists public.visit_events (
  id        bigint generated always as identity primary key,
  visit_id  uuid not null references public.visits(id) on delete cascade,
  at        timestamptz not null default now(),
  type      text not null,
  data      jsonb
);
create index if not exists visit_events_visit_idx on public.visit_events (visit_id, at, id);
create index if not exists visit_events_type_idx  on public.visit_events (type, at desc);

-- Session replay chunks: gzip'd rrweb event arrays in the private `replays` bucket.
create table if not exists public.replays (
  visit_id      uuid not null references public.visits(id) on delete cascade,
  seq           int not null,
  created_at    timestamptz not null default now(),
  bytes         int not null,
  storage_path  text not null,
  primary key (visit_id, seq)
);
create index if not exists replays_created_idx on public.replays (created_at);

-- ipinfo lookups, cached 30 days (lib/track/enrich.ts).
create table if not exists public.ip_enrichment (
  ip          text primary key,
  data        jsonb not null,
  fetched_at  timestamptz not null default now()
);

-- Link agent conversations to the visitor who had them (nullable; set best-effort by startSession).
alter table public.agent_sessions add column if not exists visitor_id uuid references public.visitors(id) on delete set null;
create index if not exists agent_sessions_visitor_idx on public.agent_sessions (visitor_id) where visitor_id is not null;

alter table public.visitors      enable row level security;
alter table public.visits        enable row level security;
alter table public.visit_events  enable row level security;
alter table public.replays       enable row level security;
alter table public.ip_enrichment enable row level security;
-- Intentionally no policies: anon and authenticated users get nothing.

-- Private bucket for replay chunks; only the service role reads or writes it.
insert into storage.buckets (id, name, public)
values ('replays', 'replays', false)
on conflict (id) do nothing;

-- Retention: replay rows 90 days; visits 400 days (events and replay rows cascade); orphaned visitors
-- and the enrichment cache with them. The storage objects behind expired replay rows are removed first
-- by /api/cron/tracking-prune (Storage API), which then calls this function.
create or replace function public.tracking_prune() returns void
language sql
set search_path = public
as $$
  delete from public.replays where created_at < now() - interval '90 days';
  delete from public.visits where started_at < now() - interval '400 days';
  delete from public.visitors v where v.last_seen < now() - interval '400 days'
    and not exists (select 1 from public.visits x where x.visitor_id = v.id);
  delete from public.ip_enrichment where fetched_at < now() - interval '90 days';
$$;
revoke execute on function public.tracking_prune() from public, anon, authenticated;
grant execute on function public.tracking_prune() to service_role;
