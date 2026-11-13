-- Resume sync: versioned PDF + text pulled from the master Google Doc (or an admin upload override).
-- Idempotent and additive. Service-role only; /resume.pdf serves the bytes from a private bucket.

create table if not exists resume_versions (
  id           uuid primary key default gen_random_uuid (),
  created_at   timestamptz not null default now(),
  source       text not null check (source in ('gdoc', 'upload')),
  sha256       text not null,
  storage_path text not null,
  bytes        int  not null,
  text         text not null default '',  -- redacted (no phone, no graduation date): what the agent may see
  pinned       boolean not null default false,  -- an upload override: the scheduled sync skips while true
  is_current   boolean not null default false
);

create index if not exists resume_versions_created_idx on resume_versions (created_at desc);

-- RLS on with a deny-all policy, matching the RAG tables: only the service role reads or writes.
alter table resume_versions enable row level security;
drop policy if exists "deny all" on resume_versions;
create policy "deny all" on resume_versions for all using (false) with check (false);

-- Promotes one version. A single UPDATE is atomic, so there is never a moment with zero (or two) current rows.
create or replace function resume_set_current (p_id uuid) returns void
language sql
as $$
  update resume_versions set is_current = (id = p_id) where is_current or id = p_id;
$$;
revoke all on function resume_set_current (uuid) from public, anon, authenticated;

-- Private bucket: the PDF is served only through the same-origin /resume.pdf route.
insert into storage.buckets (id, name, public)
  values ('resume', 'resume', false)
  on conflict (id) do nothing;
