-- Agent observability: private conversation log, public metrics-only request log, retention.
-- Additive and idempotent. All three tables are service-role only (RLS on, NO policies);
-- the app reaches them through adminClient() in lib/agent/log.ts and the /admin/chats pages.

-- One row per visitor conversation (the id lives in the visitor's sessionStorage).
create table if not exists public.agent_sessions (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  last_at          timestamptz not null default now(),
  ip_hash          text,          -- sha256(ip bucket + IP_HASH_SALT); null when the salt is unset
  country          text,          -- Vercel geo headers: coarse location only
  region           text,
  city             text,
  user_agent       text,
  referrer         text,
  first_design     text,          -- which design the visitor was looking at
  visitor_name     text,          -- filled when they send a meeting request
  visitor_email    text,
  visitor_company  text,
  share_token      text unique,   -- set only when the visitor creates a share link
  share_expires_at timestamptz,
  follow_up        boolean not null default false,
  notes            text           -- owner's private notes
);

create index if not exists agent_sessions_created_idx on public.agent_sessions (created_at desc);
create index if not exists agent_sessions_last_idx    on public.agent_sessions (last_at desc);

-- One row per message or tool step, with per-turn model telemetry on assistant rows.
create table if not exists public.agent_messages (
  id          bigint generated always as identity primary key,
  session_id  uuid not null references public.agent_sessions(id) on delete cascade,
  created_at  timestamptz not null default now(),
  role        text not null check (role in ('user', 'assistant', 'tool')),
  content     text not null default '',
  tools       jsonb,              -- tool calls / results for this turn
  sources     jsonb,              -- cited sources shown with the answer
  model       text,
  tokens_in   int,
  tokens_out  int,
  ttfb_ms     int,
  total_ms    int,
  status      int,
  error       text,
  cached      boolean not null default false
);

create index if not exists agent_messages_session_idx on public.agent_messages (session_id, created_at);
create index if not exists agent_messages_created_idx on public.agent_messages (created_at desc);

-- Metrics only, NEVER content: feeds the public /status dashboard.
create table if not exists public.agent_requests (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  model       text,
  tokens_in   int,
  tokens_out  int,
  ttfb_ms     int,
  total_ms    int,
  status      int,
  error_kind  text,
  cached      boolean not null default false,
  tool_count  int not null default 0
);

create index if not exists agent_requests_created_idx on public.agent_requests (created_at desc);

alter table public.agent_sessions enable row level security;
alter table public.agent_messages enable row level security;
alter table public.agent_requests enable row level security;
-- Intentionally no policies: anon and authenticated users get nothing.

-- Retention: conversations 180 days (messages cascade), metrics 400 days.
-- Scheduled by Vercel Cron (/api/cron/agent-prune, vercel.json); pg_cron works too:
--   select cron.schedule('agent-prune', '17 3 * * *', 'select public.agent_prune()');
create or replace function public.agent_prune() returns void
language sql
set search_path = public
as $$
  delete from public.agent_sessions where last_at < now() - interval '180 days';
  delete from public.agent_requests where created_at < now() - interval '400 days';
$$;
revoke execute on function public.agent_prune() from public, anon, authenticated;
grant execute on function public.agent_prune() to service_role;
