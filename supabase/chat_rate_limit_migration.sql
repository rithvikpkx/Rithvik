-- Per-IP rate-limit window for /api/chat, plus two RLS corrections.
-- Mirrors contact_submissions: service-role only, no anon policies.

-- ── /api/chat rate limiting ──────────────────────────────────────────────
-- WHY: every chat turn fires three OpenAI calls (HyDE completion, embedding,
-- streamed completion) from a public, unauthenticated endpoint. /api/contact
-- had a 3/hr/IP limit; chat had none, so a single script could drain the
-- OpenAI key. One row per accepted request; the route counts rows in the
-- trailing window before spending anything.
create table if not exists public.chat_requests (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  ip          text
);

create index if not exists chat_requests_ip_created_idx
  on public.chat_requests (ip, created_at desc);

alter table public.chat_requests enable row level security;
-- Intentionally no policies: only the service-role key (server route) touches this.

-- Rows outside the window are dead weight — this table is a counter, not a log
-- (unlike contact_submissions, which doubles as a record of who reached out).
-- The route prunes opportunistically; run this by hand if it ever gets away.
delete from public.chat_requests where created_at < now() - interval '1 day';

-- ── Education draft rows were readable via the anon API ──────────────────
-- projects/experience correctly gate public reads on `published`; education's
-- policy was USING (true), so unpublished draft rows were fetchable straight
-- from PostgREST even though the UI filters them. The site itself is
-- unaffected: every read path uses serverClient()/adminClient() (service role),
-- which bypasses RLS.
drop policy if exists "Public read education" on public.education;
drop policy if exists "public read" on public.education;
create policy "public read" on public.education
  for select using (published = true);
