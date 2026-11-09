-- Atomic rate limiting for the public API routes (/api/chat, /api/contact).
-- Replaces the app-side count-then-insert, which let parallel bursts through
-- (every request counted before any inserted). Additive and idempotent:
-- chat_requests / contact_submissions stay; contact_submissions is still the send log.

create table if not exists public.rate_limit_hits (
  id          bigint generated always as identity primary key,
  bucket      text not null,          -- 'chat' | 'contact'
  key         text not null,          -- IPv4, or IPv6 /64 (lib/rate-limit.ts ipBucket)
  created_at  timestamptz not null default now()
);

create index if not exists rate_limit_hits_bucket_key_created_idx
  on public.rate_limit_hits (bucket, key, created_at);
create index if not exists rate_limit_hits_bucket_created_idx
  on public.rate_limit_hits (bucket, created_at);

alter table public.rate_limit_hits enable row level security;
-- Intentionally no policies: only the service role (server routes) touches this.

-- Checks both caps, records the hit if allowed, prunes the bucket's expired rows.
-- Denied hits are not recorded, so a blocked caller's window still reopens.
--
-- Concurrency: one transaction-scoped advisory lock per BUCKET serialises
-- check+insert, so a burst can't all count before any inserts. Per bucket rather
-- than per key because the global cap counts across keys; traffic is a handful
-- of requests a minute, so the serialisation costs nothing. The lock is released
-- at commit (each PostgREST rpc call is its own transaction).
create or replace function public.rate_limit_hit(
  p_bucket         text,
  p_key            text,
  p_limit          int,
  p_window_seconds int,
  p_global_limit   int
) returns table (allowed boolean, retry_after int)
language plpgsql
set search_path = public
as $$
declare
  v_since  timestamptz := now() - make_interval(secs => p_window_seconds);
  v_count  int;
  v_oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('rate_limit_hit:' || p_bucket));

  delete from rate_limit_hits where bucket = p_bucket and created_at < v_since;

  select count(*), min(created_at) into v_count, v_oldest
    from rate_limit_hits where bucket = p_bucket and key = p_key;
  if v_count >= p_limit then
    -- The window reopens when this key's oldest hit ages out.
    return query select false, greatest(1, ceil(extract(epoch from v_oldest + make_interval(secs => p_window_seconds) - now()))::int);
    return;
  end if;

  select count(*), min(created_at) into v_count, v_oldest
    from rate_limit_hits where bucket = p_bucket;
  if v_count >= p_global_limit then
    return query select false, greatest(1, ceil(extract(epoch from v_oldest + make_interval(secs => p_window_seconds) - now()))::int);
    return;
  end if;

  insert into rate_limit_hits (bucket, key) values (p_bucket, p_key);
  return query select true, 0;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; only the service role may call it.
revoke execute on function public.rate_limit_hit(text, text, int, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, text, int, int, int) to service_role;

-- chat_requests is no longer written; clear its backlog (the table is kept).
delete from public.chat_requests where created_at < now() - interval '1 day';
