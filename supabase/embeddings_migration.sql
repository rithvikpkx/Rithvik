-- RAG bot: pgvector store for the portfolio's hand-curated context chunks.
-- Apply once via the Supabase SQL editor; then run `npx tsx scripts/embed.ts`
-- to populate. The /api/chat route embeds the user query with
-- text-embedding-3-small (1536-dim) and calls match_embeddings(...) below
-- to pull the top-N chunks by cosine similarity.
--
-- Idempotent: every step uses IF NOT EXISTS or CREATE OR REPLACE.

create extension if not exists vector;

create table if not exists embeddings (
  id          uuid primary key default gen_random_uuid (),
  content     text not null,
  metadata    jsonb default '{}'::jsonb,
  embedding   vector(1536) not null,
  created_at  timestamptz not null default now()
);

-- IVFFlat with cosine distance. `lists` = sqrt(rows) is the usual heuristic;
-- 100 is fine for the dozens-of-rows we'll have. Build the index after the
-- table is populated for best recall (re-run REINDEX if you re-seed).
create index if not exists embeddings_embedding_idx
  on embeddings using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Top-N nearest neighbours by cosine similarity (1 - cosine_distance).
-- Returns the chunk text + metadata + similarity score so the caller can
-- order/filter further if needed. The api/chat route just uses .content.
create or replace function match_embeddings (
  query_embedding vector(1536),
  match_count     int default 5
) returns table (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
language sql stable
as $$
  select
    e.id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from embeddings e
  order by e.embedding <=> query_embedding
  limit match_count;
$$;

-- RLS: lock down direct table access. The chat route uses the service-role
-- key via adminClient(), which bypasses RLS, so the function works in
-- production. Anon clients can't read the embeddings table directly.
alter table embeddings enable row level security;

drop policy if exists "embeddings service-role only" on embeddings;
create policy "embeddings service-role only"
  on embeddings for all
  using (false)
  with check (false);
