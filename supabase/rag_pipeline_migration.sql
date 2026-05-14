-- RAG pipeline schema: two parallel pgvector stores (primary + secondary)
-- plus a secondary_documents metadata table and a private Storage bucket.
-- Idempotent: re-running updates the RPCs and policies but won't wipe data.
--
-- Replaces the legacy single-table `embeddings` from the earlier static
-- script-driven era. The new architecture auto-embeds primary content on
-- every inline edit and accepts secondary uploads via SecondaryContextPanel.

create extension if not exists vector;

-- Drop the legacy single-table store.
drop function if exists match_embeddings(vector, int);
drop table if exists embeddings;

-- ── PRIMARY EMBEDDINGS ────────────────────────────────────────────────────
create table if not exists primary_embeddings (
  id           uuid primary key default gen_random_uuid (),
  source_table text not null check (source_table in
    ('projects', 'experience', 'education', 'site_content')),
  source_id    text not null,
  content      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  embedding    vector(1536) not null,
  updated_at   timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists primary_embeddings_embedding_idx
  on primary_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_primary (
  query_embedding vector(1536),
  match_count     int default 3
) returns table (
  id           uuid,
  source_table text,
  source_id    text,
  content      text,
  metadata     jsonb,
  similarity   float
)
language sql stable
as $$
  select p.id, p.source_table, p.source_id, p.content, p.metadata,
         1 - (p.embedding <=> query_embedding) as similarity
  from primary_embeddings p
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- ── SECONDARY DOCUMENTS + EMBEDDINGS ──────────────────────────────────────
create table if not exists secondary_documents (
  id           uuid primary key default gen_random_uuid (),
  filename     text not null,
  mime_type    text not null,
  storage_path text not null unique,
  byte_size    int  not null,
  uploaded_at  timestamptz not null default now()
);

create table if not exists secondary_embeddings (
  id           uuid primary key default gen_random_uuid (),
  document_id  uuid not null references secondary_documents (id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  metadata     jsonb not null default '{}'::jsonb,
  embedding    vector(1536) not null,
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists secondary_embeddings_embedding_idx
  on secondary_embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_secondary (
  query_embedding vector(1536),
  match_count     int default 3
) returns table (
  id           uuid,
  document_id  uuid,
  content      text,
  metadata     jsonb,
  similarity   float
)
language sql stable
as $$
  select s.id, s.document_id, s.content, s.metadata,
         1 - (s.embedding <=> query_embedding) as similarity
  from secondary_embeddings s
  order by s.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS: service-role only on all three tables ────────────────────────────
-- The chat route and inline-edit actions hit these via adminClient() which
-- bypasses RLS. Anon clients can't read or write.
alter table primary_embeddings   enable row level security;
alter table secondary_documents  enable row level security;
alter table secondary_embeddings enable row level security;

drop policy if exists "deny all" on primary_embeddings;
create policy "deny all" on primary_embeddings   for all using (false) with check (false);

drop policy if exists "deny all" on secondary_documents;
create policy "deny all" on secondary_documents  for all using (false) with check (false);

drop policy if exists "deny all" on secondary_embeddings;
create policy "deny all" on secondary_embeddings for all using (false) with check (false);

-- ── STORAGE BUCKET: 'secondary' (private) ────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('secondary', 'secondary', false)
  on conflict (id) do nothing;
