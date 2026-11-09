-- Semantic response cache + public status backend. Additive and idempotent. DO NOT apply to production until reviewed:
--   supabase db query --linked -f supabase/agent_cache_metrics_migration.sql
-- Service-role only (RLS on, NO policies): reached through adminClient() in lib/agent/cache.ts and /api/status.
-- Until this runs the app degrades silently: the cache always misses and /api/status returns empty windows.

create extension if not exists vector;
create extension if not exists pg_net;   -- async HTTP from SQL (the uptime ping)
create extension if not exists pg_cron;  -- the schedule; may need enabling in Dashboard > Database > Extensions first

-- ── RESPONSE CACHE ───────────────────────────────────────────────────────
-- One row per cached first-turn answer. `frames` is the ordered v2 stream to replay (search/sources/text/done/trailer;
-- never a tool frame). `content_hash` covers site content + resume version + secondary docs + model, so any edit
-- makes every older row unreachable (they age out via agent_prune()).
create table if not exists public.agent_cache (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz,
  hits        int not null default 0,
  question    text not null,
  embedding   vector(1536) not null,
  content_hash text not null,
  model       text not null,
  frames      jsonb not null,
  expires_at  timestamptz not null
);
create index if not exists agent_cache_embedding_idx on public.agent_cache using hnsw (embedding vector_cosine_ops);
create index if not exists agent_cache_expires_idx on public.agent_cache (expires_at);

-- Nearest live entry for this content version at or above the cosine threshold.
create or replace function public.match_agent_cache (
  query_embedding vector(1536),
  p_content_hash  text,
  threshold       float default 0.95,
  match_count     int default 1
) returns table (id uuid, question text, frames jsonb, created_at timestamptz, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.question, c.frames, c.created_at, 1 - (c.embedding <=> query_embedding) as similarity
  from public.agent_cache c
  where c.content_hash = p_content_hash
    and c.expires_at > now()
    and 1 - (c.embedding <=> query_embedding) >= threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Atomic hit counter (a read-modify-write from the app would lose concurrent hits).
create or replace function public.agent_cache_hit (p_id uuid) returns void
language sql
set search_path = public
as $$ update public.agent_cache set hits = hits + 1, last_hit_at = now() where id = p_id; $$;

-- ── UPTIME ───────────────────────────────────────────────────────────────
create table if not exists public.uptime_checks (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  ok     boolean not null,
  status int,            -- null when the ping got no response at all
  ms     int,
  region text            -- reserved: pg_net pings from one region today
);
create index if not exists uptime_checks_at_idx on public.uptime_checks (at desc);

alter table public.agent_cache   enable row level security;
alter table public.uptime_checks enable row level security;

-- pg_net is fire-and-forget: a request's response lands later in net._http_response. So each tick first records
-- the pings it sent last time, then sends the next one. shortcut: `ms` is send-to-response-row time, which includes
-- up to a few seconds of pg_net queueing; fine for up/down, loose as a latency figure.
create table if not exists public.uptime_pending (
  request_id bigint primary key,
  sent_at    timestamptz not null default now()
);
alter table public.uptime_pending enable row level security;

create or replace function public.uptime_tick (p_url text default 'https://rithvik.ai/api/health') returns void
language plpgsql
set search_path = public
as $$
begin
  -- Answered pings become checks; pings still unanswered after 2 minutes become failures.
  insert into public.uptime_checks (at, ok, status, ms)
  select p.sent_at,
         r.status_code between 200 and 299,
         r.status_code,
         (extract(epoch from (r.created - p.sent_at)) * 1000)::int
  from public.uptime_pending p
  join net._http_response r on r.id = p.request_id;

  insert into public.uptime_checks (at, ok, status, ms)
  select p.sent_at, false, null, null
  from public.uptime_pending p
  where p.sent_at < now() - interval '2 minutes'
    and not exists (select 1 from net._http_response r where r.id = p.request_id);

  delete from public.uptime_pending p
  where exists (select 1 from net._http_response r where r.id = p.request_id)
     or p.sent_at < now() - interval '2 minutes';

  insert into public.uptime_pending (request_id) select net.http_get(url := p_url, timeout_milliseconds := 8000);
end;
$$;

-- LAUNCH STEP (left off on purpose: the apex still serves the old site, which has no /api/health, so every ping would
-- record a failure). Run this ONCE when the new site goes live on rithvik.ai:
--
--   select cron.schedule('rithvik-uptime', '*/5 * * * *', $$select public.uptime_tick('https://rithvik.ai/api/health')$$);
--
-- To stop it:  select cron.unschedule('rithvik-uptime');
-- To inspect:  select * from cron.job_run_details order by start_time desc limit 5;  select * from public.uptime_checks order by at desc limit 5;

-- ── READ MODELS for /api/status ──────────────────────────────────────────
-- Metrics for the last p_hours, bucketed by 'hour' or 'day'. Errors are 5xx; aborted (499) and rate-limited (429)
-- requests are counted as requests but not errors. Percentiles skip rows without a timing (rate-limited).
create or replace function public.agent_metrics (p_hours int, p_bucket text default 'hour') returns jsonb
language sql stable
set search_path = public
as $$
  with r as (
    select * from public.agent_requests where created_at >= now() - make_interval(hours => p_hours)
  )
  select jsonb_build_object(
    'requests',   (select count(*) from r),
    'errors',     (select count(*) from r where status >= 500),
    'cacheHits',  (select count(*) from r where cached),
    'tokens',     (select coalesce(sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)), 0) from r),
    'ttfbP50',    (select percentile_cont(0.5)  within group (order by ttfb_ms)  from r),
    'ttfbP95',    (select percentile_cont(0.95) within group (order by ttfb_ms)  from r),
    'totalP50',   (select percentile_cont(0.5)  within group (order by total_ms) from r),
    'totalP95',   (select percentile_cont(0.95) within group (order by total_ms) from r),
    'models',     coalesce((select jsonb_agg(m order by m.requests desc) from (
                    select coalesce(model, 'unknown') as model, count(*) as requests,
                           sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)) as tokens
                    from r group by 1) m), '[]'::jsonb),
    'series',     coalesce((select jsonb_agg(s order by s.t) from (
                    select date_trunc(p_bucket, created_at) as t, count(*) as requests,
                           count(*) filter (where status >= 500) as errors,
                           count(*) filter (where cached) as cached,
                           percentile_cont(0.5) within group (order by ttfb_ms) as "p50TtfbMs"
                    from r group by 1) s), '[]'::jsonb)
  );
$$;

-- Uptime fractions (0-1) for 24h/7d/30d plus the last 288 checks (24h at one per 5 minutes), oldest first.
create or replace function public.uptime_summary () returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'd1',  (select avg(ok::int) from public.uptime_checks where at >= now() - interval '1 day'),
    'd7',  (select avg(ok::int) from public.uptime_checks where at >= now() - interval '7 days'),
    'd30', (select avg(ok::int) from public.uptime_checks where at >= now() - interval '30 days'),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('t', at, 'ok', ok, 'ms', coalesce(ms, 0)) order by at)
                        from (select * from public.uptime_checks order by at desc limit 288) x), '[]'::jsonb)
  );
$$;

-- Retention: replaces agent_prune() from agent_observability_migration.sql with the same body plus the new tables.
create or replace function public.agent_prune() returns void
language sql
set search_path = public
as $$
  delete from public.agent_sessions where last_at < now() - interval '180 days';
  delete from public.agent_requests where created_at < now() - interval '400 days';
  delete from public.agent_cache where expires_at < now();
  delete from public.uptime_checks where at < now() - interval '90 days';
$$;

-- Service role only.
revoke execute on function public.match_agent_cache(vector, text, float, int) from public, anon, authenticated;
revoke execute on function public.agent_cache_hit(uuid) from public, anon, authenticated;
revoke execute on function public.uptime_tick(text) from public, anon, authenticated;
revoke execute on function public.agent_metrics(int, text) from public, anon, authenticated;
revoke execute on function public.uptime_summary() from public, anon, authenticated;
revoke execute on function public.agent_prune() from public, anon, authenticated;
grant execute on function public.match_agent_cache(vector, text, float, int) to service_role;
grant execute on function public.agent_cache_hit(uuid) to service_role;
grant execute on function public.uptime_tick(text) to service_role;
grant execute on function public.agent_metrics(int, text) to service_role;
grant execute on function public.uptime_summary() to service_role;
grant execute on function public.agent_prune() to service_role;
