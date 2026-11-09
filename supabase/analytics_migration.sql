-- Admin analytics dashboard + public /status aggregates. Additive and idempotent:
--   supabase db query --linked -f supabase/analytics_migration.sql
-- Needs tracking_migration.sql, agent_observability_migration.sql and agent_cache_metrics_migration.sql first.
-- Every function is service-role only (the app calls them through adminClient() in lib/analytics/server.ts).
-- Until this runs the dashboard shows its empty states and /status hides the visitor numbers; nothing throws.
--
-- Exclusions applied everywhere: bot visitors and bot visits, and the owner's own conversations
-- (agent_sessions.is_owner, set by the agent logger). The owner's browsing is already purged by /api/t/owner.

-- The owner's chats are logged (so Share works for him) but flagged, and every analytic skips them.
alter table public.agent_sessions add column if not exists is_owner boolean not null default false;

-- Coordinates from Vercel's geo headers, for the admin globe (city points). Null for older rows: those fall back to
-- their country's centroid in lib/analytics/geo.ts.
alter table public.visitors add column if not exists lat double precision;
alter table public.visitors add column if not exists lng double precision;

-- Helpers ------------------------------------------------------------------------------------------------------------

-- "https://www.linkedin.com/in/x" -> "linkedin.com"; null for no referrer.
create or replace function public.ref_host(u text) returns text
language sql immutable
set search_path = public
as $$ select lower(substring(u from '^[a-zA-Z][a-zA-Z0-9+.-]*://(?:www\.)?([^/:?#]+)')) $$;

-- Headline numbers for one window [p_since, p_until). p_since null = all time.
create or replace function public.admin_kpis (p_since timestamptz, p_until timestamptz) returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.* from public.visits x join public.visitors p on p.id = x.visitor_id
    where not x.is_bot and not p.is_bot and x.started_at >= coalesce(p_since, '-infinity') and x.started_at < p_until
  ),
  e as (select ev.* from public.visit_events ev join v on v.id = ev.visit_id),
  per as (
    select v.id,
      coalesce(sum((e.data->>'ms')::numeric) filter (where e.type = 'active'), 0) as active_ms,
      coalesce(bool_or(e.type in ('click', 'overlay', 'design', 'scroll', 'agent_open', 'composer_open')), false) as engaged
    from v left join e on e.visit_id = v.id group by v.id
  ),
  u as (
    select v.visitor_id, count(*) as n, min(v.started_at) as first_in from v group by 1
  ),
  s as (
    select * from public.agent_sessions
    where not is_owner and created_at >= coalesce(p_since, '-infinity') and created_at < p_until
  ),
  src as (
    select coalesce(nullif(public.ref_host(referrer), ''), 'direct') as host, count(*) as n from v
    where public.ref_host(referrer) is null or public.ref_host(referrer) !~ '(^|\.)(rithvik\.ai|vercel\.app|localhost)$'
    group by 1 order by 2 desc limit 1
  )
  select jsonb_build_object(
    'visits',        (select count(*) from v),
    'visitors',      (select count(*) from u),
    'returning',     (select count(*) from u join public.visitors p on p.id = u.visitor_id where u.n > 1 or p.first_seen < u.first_in - interval '30 minutes'),
    'identified',    (select count(*) from public.visitors p where not p.is_bot and p.identified_at >= coalesce(p_since, '-infinity') and p.identified_at < p_until),
    'meetings',      (select count(*) from s where visitor_email is not null),
    'emails',        (select count(*) from e where type = 'composer_send'),
    'chats',         (select count(*) from s),
    'avgActiveMs',   (select round(avg(active_ms)) from per),
    'bounces',       (select count(*) from per where not engaged and active_ms < 10000),
    'topSource',     (select jsonb_build_object('host', host, 'visits', n) from src)
  );
$$;

-- Everything else on the dashboard for one window, bucketed by 'hour' or 'day'. p_decline: lower-case substrings that
-- mark a declined answer (lib/chat-actions.ts DECLINE_MARKERS), passed in so the markers live in one place.
create or replace function public.admin_analytics (p_since timestamptz, p_until timestamptz, p_bucket text, p_decline text[] default '{}')
returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.* from public.visits x join public.visitors p on p.id = x.visitor_id
    where not x.is_bot and not p.is_bot and x.started_at >= coalesce(p_since, '-infinity') and x.started_at < p_until
  ),
  e as (select ev.*, v.visitor_id from public.visit_events ev join v on v.id = ev.visit_id),
  who as (select p.* from public.visitors p where p.id in (select visitor_id from v)),
  sec as (
    select e.visit_id, e.data->>'id' as id, e.at,
           lead(e.at) over (partition by e.visit_id order by e.at, e.id) as next_at
    from e where e.type = 'section' and e.data ? 'id'
  ),
  feat as (
    select e.visitor_id, case
      when e.type = 'design' and e.data->>'design' = 'classic' then 'palette:' || coalesce(e.data->>'theme', '?')
      when e.type = 'design' then 'design:' || coalesce(e.data->>'design', '?')
      when e.type = 'overlay' and e.data->>'kind' = 'play' then 'play:' || coalesce(nullif(e.data->>'ref', ''), 'menu')
      when e.type = 'overlay' then 'overlay:' || coalesce(e.data->>'kind', '?')
      when e.type = 'resume' then 'resume:' || coalesce(e.data->>'action', '?')
      when e.type in ('agent_turn', 'composer_send') then e.type
      when e.type = 'outbound' then 'outbound:' || coalesce(e.data->>'host', '?')
      when e.type = 'click' and e.data->>'hook' = 'copy' then 'copy_email'
      when e.type = 'click' and e.data->>'text' = 'Performance mode' then 'lite'
      when e.type = 'click' and e.data->>'text' = 'Share this conversation' then 'share'
      when e.type = 'click' and e.data->>'text' in ('Hold to talk', 'Stop recording') then 'voice'
      when e.type = 'click' and e.data->>'text' = 'Speak replies aloud' then 'speak'
      when e.type = 'click' and e.data->>'text' = 'Ask the agent about the selected text' then 'ask_this'
      when e.type = 'click' and e.data->>'text' in ('Copy chat as Markdown', 'Download chat as Markdown') then 'chat_export'
    end as key
    from e
    union all
    select v.visitor_id, 'deeplink' from v where v.entry_url ~ '([?&]theme=|/work/)'
  ),
  s as (
    select * from public.agent_sessions
    where not is_owner and created_at >= coalesce(p_since, '-infinity') and created_at < p_until
  ),
  m as (select am.* from public.agent_messages am join s on s.id = am.session_id),
  a as (select * from m where role = 'assistant')
  select jsonb_build_object(
    'series', coalesce((select jsonb_agg(x order by x.t) from (
      select date_trunc(p_bucket, started_at) as t, count(*) as visits, count(distinct visitor_id) as visitors from v group by 1) x), '[]'),
    'entries', coalesce((select jsonb_agg(x) from (
      select coalesce(nullif(regexp_replace(split_part(entry_url, '?', 1), '^https?://[^/]+', ''), ''), '/') as label,
             count(*) as value from v group by 1 order by 2 desc limit 8) x), '[]'),
    'sections', coalesce((select jsonb_agg(x) from (
      select id as label, count(distinct visit_id) as value,
             round(avg(least(extract(epoch from next_at - at), 600)) filter (where next_at is not null)) as dwell
      from sec group by 1 order by 2 desc limit 14) x), '[]'),
    'scroll', coalesce((select jsonb_agg(x order by x.pct) from (
      select (data->>'pct')::int as pct, count(distinct visit_id) as visits from e
      where type = 'scroll' and data->>'pct' in ('25', '50', '75', '100') group by 1) x), '[]'),
    'countries', coalesce((select jsonb_agg(x) from (
      select country as label, count(*) as value from who where country is not null group by 1 order by 2 desc limit 40) x), '[]'),
    'cities', coalesce((select jsonb_agg(x) from (
      select city, region, country, avg(lat) as lat, avg(lng) as lng, count(*) as value from who
      where city is not null or country is not null group by city, region, country order by value desc limit 300) x), '[]'),
    'ipTypes', coalesce((select jsonb_agg(x) from (
      select coalesce(ip_type, 'unknown') as label, count(*) as value from who group by 1 order by 2 desc) x), '[]'),
    'orgs', coalesce((select jsonb_agg(x) from (
      select coalesce(company_given, company) as label, max(ip_type) as type, count(*) as value from who
      where coalesce(company_given, company) is not null group by 1 order by 3 desc limit 15) x), '[]'),
    'networks', coalesce((select jsonb_agg(x) from (
      select org as label, max(ip_type) as type, count(*) as value from who where org is not null group by 1 order by 3 desc limit 10) x), '[]'),
    'devices', coalesce((select jsonb_agg(x) from (
      select coalesce(device, 'unknown') as label, count(*) as value from who group by 1 order by 2 desc) x), '[]'),
    'browsers', coalesce((select jsonb_agg(x) from (
      select coalesce(split_part(browser, ' ', 1), 'unknown') as label, count(*) as value from who group by 1 order by 2 desc limit 6) x), '[]'),
    'os', coalesce((select jsonb_agg(x) from (
      select coalesce(os, 'unknown') as label, count(*) as value from who group by 1 order by 2 desc limit 6) x), '[]'),
    'referrers', coalesce((select jsonb_agg(x) from (
      select coalesce(public.ref_host(referrer), 'direct') as label, count(*) as value from v
      where public.ref_host(referrer) is null or public.ref_host(referrer) !~ '(^|\.)(rithvik\.ai|vercel\.app|localhost)$'
      group by 1 order by 2 desc limit 10) x), '[]'),
    'campaigns', coalesce((select jsonb_agg(x) from (
      select concat_ws(' / ', utm->>'utm_source', utm->>'utm_medium', utm->>'utm_campaign') as label, count(*) as value from v
      where utm is not null group by 1 order by 2 desc limit 8) x), '[]'),
    'features', coalesce((select jsonb_agg(x) from (
      select key, count(*) as uses, count(distinct visitor_id) as visitors from feat where key is not null group by 1) x), '[]'),
    'jsErrors', coalesce((select jsonb_agg(x) from (
      select left(data->>'msg', 140) as label, count(*) as value from e where type = 'error' group by 1 order by 2 desc limit 6) x), '[]'),
    'vitals', (select jsonb_build_object(
      'lcp', percentile_cont(0.75) within group (order by (data->>'lcp')::numeric),
      'inp', percentile_cont(0.75) within group (order by (data->>'inp')::numeric),
      'cls', percentile_cont(0.75) within group (order by (data->>'cls')::numeric),
      'n', count(*)) from e where type = 'perf'),
    'rag', jsonb_build_object(
      'conversations', (select count(*) from s),
      'chatters', (select count(distinct visitor_id) from s),
      'turns', (select count(*) from m where role = 'user'),
      'cached', (select count(*) from a where cached),
      'answers', (select count(*) from a),
      'errors', (select count(*) from a where status >= 500 or (error is not null and status is distinct from 499)),
      'declines', (select count(*) from a where lower(content) like any (select '%' || d || '%' from unnest(p_decline) d)),
      'ttfbP50', (select percentile_cont(0.5) within group (order by ttfb_ms) from a where not cached),
      'ttfbP95', (select percentile_cont(0.95) within group (order by ttfb_ms) from a where not cached),
      'totalP50', (select percentile_cont(0.5) within group (order by total_ms) from a),
      'totalP95', (select percentile_cont(0.95) within group (order by total_ms) from a),
      'models', coalesce((select jsonb_agg(x) from (
        select coalesce(model, 'unknown') as model, count(*) as requests,
               sum(coalesce(tokens_in, 0) + coalesce(tokens_out, 0)) as tokens from a group by 1) x), '[]'),
      'tools', coalesce((select jsonb_agg(x) from (
        select content as label, count(*) as value from m where role = 'tool' group by 1 order by 2 desc limit 12) x), '[]'),
      'series', coalesce((select jsonb_agg(x order by x.t) from (
        select date_trunc(p_bucket, created_at) as t, count(*) as turns from m where role = 'user' group by 1) x), '[]'),
      'questions', coalesce((select jsonb_agg(x) from (
        select q.content as q, q.session_id as sid,
               exists (select 1 from a where a.session_id = q.session_id and a.created_at >= q.created_at
                       and lower(a.content) like any (select '%' || d || '%' from unnest(p_decline) d)) as declined
        from m q where q.role = 'user' and q.content !~ '^/' order by q.created_at desc limit 400) x), '[]')
    )
  );
$$;

-- Visitors worth a follow-up: everyone with a signal in the window, with the raw signals (scored in lib/analytics).
create or replace function public.admin_outreach (p_since timestamptz, p_until timestamptz, p_limit int default 150)
returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.* from public.visits x join public.visitors p on p.id = x.visitor_id
    where not x.is_bot and not p.is_bot and x.started_at >= coalesce(p_since, '-infinity') and x.started_at < p_until
  ),
  e as (select ev.*, v.visitor_id from public.visit_events ev join v on v.id = ev.visit_id),
  agg as (
    select v.visitor_id,
      count(distinct v.id) as visits,
      coalesce(sum((e.data->>'ms')::numeric) filter (where e.type = 'active'), 0) as active_ms,
      count(*) filter (where e.type = 'composer_send') as emails,
      count(*) filter (where e.type = 'resume' and e.data->>'action' = 'download') as resume_downloads,
      count(*) filter (where e.type = 'resume' and e.data->>'action' = 'open') as resume_opens,
      count(distinct e.data->>'ref') filter (where e.type = 'overlay' and e.data->>'kind' = 'case') as cases,
      count(distinct e.data->>'id') filter (where e.type = 'section') as sections,
      count(*) filter (where e.type = 'agent_turn') as turns,
      max(e.at) as last_at
    from v left join e on e.visit_id = v.id
    group by 1
  )
  select coalesce(jsonb_agg(r), '[]') from (
    select p.id, p.name, p.email, coalesce(p.company_given, p.company) as company, p.org, p.ip_type, p.city, p.region, p.country,
           p.last_seen, p.visits as total_visits, agg.visits, agg.active_ms, agg.emails, agg.resume_downloads, agg.resume_opens,
           agg.cases, agg.sections, agg.turns,
           (select count(*) from public.agent_sessions s where s.visitor_id = p.id and not s.is_owner and s.visitor_email is not null) as meetings,
           (select s.id from public.agent_sessions s where s.visitor_id = p.id and not s.is_owner order by s.created_at desc limit 1) as last_chat
    from agg join public.visitors p on p.id = agg.visitor_id
    order by (p.email is not null) desc, agg.emails + agg.resume_downloads desc, agg.active_ms desc
    limit p_limit
  ) r;
$$;

-- Public /status: counts and country-level totals only (no ids, IPs, orgs, cities, questions). Small countries are
-- folded into "other" by lib/analytics/public.ts before anything is rendered.
create or replace function public.public_traffic (p_since timestamptz, p_bucket text) returns jsonb
language sql stable
set search_path = public
as $$
  with v as (
    select x.* from public.visits x join public.visitors p on p.id = x.visitor_id
    where not x.is_bot and not p.is_bot and x.started_at >= p_since
  )
  select jsonb_build_object(
    'visits', (select count(*) from v),
    'visitors', (select count(distinct visitor_id) from v),
    'series', coalesce((select jsonb_agg(x order by x.t) from (
      select date_trunc(p_bucket, started_at) as t, count(*) as visits from v group by 1) x), '[]'),
    'countries', coalesce((select jsonb_agg(x) from (
      select p.country, count(distinct p.id) as visitors from v join public.visitors p on p.id = v.visitor_id
      where p.country is not null group by 1) x), '[]')
  );
$$;

revoke execute on function public.ref_host(text) from public, anon, authenticated;
revoke execute on function public.admin_kpis(timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.admin_analytics(timestamptz, timestamptz, text, text[]) from public, anon, authenticated;
revoke execute on function public.admin_outreach(timestamptz, timestamptz, int) from public, anon, authenticated;
revoke execute on function public.public_traffic(timestamptz, text) from public, anon, authenticated;
grant execute on function public.ref_host(text) to service_role;
grant execute on function public.admin_kpis(timestamptz, timestamptz) to service_role;
grant execute on function public.admin_analytics(timestamptz, timestamptz, text, text[]) to service_role;
grant execute on function public.admin_outreach(timestamptz, timestamptz, int) to service_role;
grant execute on function public.public_traffic(timestamptz, text) to service_role;
