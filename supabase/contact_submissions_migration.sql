-- Inline email composer: per-IP rate-limit window + a record of who reached out.
-- Service-role only (the /api/contact route uses adminClient()); no anon policies.
create table if not exists public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  ip          text,
  from_email  text,
  subject     text,
  status      text not null default 'sent'
);

create index if not exists contact_submissions_ip_created_idx
  on public.contact_submissions (ip, created_at desc);

alter table public.contact_submissions enable row level security;
-- Intentionally no policies: only the service-role key (server route) can read/write.
