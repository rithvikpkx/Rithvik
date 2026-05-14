# RAG Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static-paragraph RAG bot with a dual-source, self-sustaining pipeline. **Primary context** = every editable piece of content on the website, auto-embedded the moment it's saved through the inline-edit UI. **Secondary context** = files Rithvik uploads (images, PDFs, DOCX, TXT, MD) via a panel that only appears in edit mode. Every chat query pulls top-3 primary + top-3 secondary chunks. After one-time setup (apply SQL, set env vars, click "backfill"), the pipeline runs itself — no terminal scripts, no manual re-runs.

**Architecture:** Two parallel `pgvector` stores in Supabase (`primary_embeddings`, `secondary_embeddings`), each with its own `match_*` RPC. Inline-edit server actions in `app/admin/actions.ts` perform their DB write first, then synchronously call an `embedRecord(...)` helper that upserts the relevant embedding row (save-first, embed-after — if OpenAI fails the content is already saved and a "Re-embed all" action can recover). A new `SecondaryContextPanel` floats near the RAG launcher when `isEditing` is true, supports drag-drop uploads, lists current documents, and lets you delete any of them. File text is extracted server-side (`pdf-parse`, `mammoth`, plain UTF-8 for text), images are captioned via `gpt-4o-mini` and the caption gets embedded. `app/api/chat/route.ts` calls both `match_primary` and `match_secondary` per turn and assembles a labeled context block for the prompt.

**Tech stack:** Next.js 16 server actions, Supabase pgvector + Storage, OpenAI (`text-embedding-3-small`, `gpt-4o-mini` for image captions), DeepSeek (`deepseek-chat`) for completions (unchanged), `pdf-parse`, `mammoth`.

---

## Decisions locked in (from spec + clarifying questions)

| Decision | Choice | Why |
|---|---|---|
| Save-vs-embed ordering | **Save first, embed after** in the same server action | Saves never fail due to OpenAI hiccups; embedding failure is recoverable via "Re-embed" button. |
| Image embedding | **Caption via `gpt-4o-mini`, embed caption** | Keeps the vector store single-modality (text-embedding-3-small @ 1536-dim) while still making images searchable. |
| Schema shape | **Two tables: `primary_embeddings`, `secondary_embeddings`** + `secondary_documents` for file metadata | Clean separation, parallel retrieval is trivial, each table can evolve independently. |
| Retrieval | Top-3 from each table per query, concatenated into a labeled context block | Matches the spec exactly. |
| Initial backfill | UI button in `SecondaryContextPanel` → "Re-embed all primary content" | No terminal scripts required after one-time SQL + env-var setup. |
| Static `scripts/embed.ts` | Delete it | Stale once the auto-pipeline is in. Backfill lives in a server action. |

## What "every scrap of important information" means in v1

The content tables already cover everything editable through the inline-edit UI:

- `projects` (rows) — title, badge, description, tags, link URLs
- `experience` (rows) — org, role, type, date_range, description, tags, location
- `education` (rows) — school, degree, concentrations
- `site_content` (key/value) — `hero.tagline`, `hero.sub_line`, `bento.location`, `bento.building`, `bento.stats`, `bento.stack`, `bento.interests`, `contact.headline`, `contact.sub`, `contact.link.*`

Static page chrome (section headers, nav labels, footer) is hard-coded and not in scope — RAG doesn't need to know about the word "Projects" sitting above the projects section. If you later move any of that into `site_content`, the pipeline picks it up automatically.

## Schema overview

```
primary_embeddings
  id           uuid pk
  source_table text   -- 'projects' | 'experience' | 'education' | 'site_content'
  source_id    text   -- projects.id / experience.id / education.id / site_content.key (string for uniformity)
  content      text   -- the chunk text that got embedded
  metadata     jsonb
  embedding    vector(1536)
  updated_at   timestamptz default now()
  UNIQUE (source_table, source_id)        -- one row per source row, upsert on edit

secondary_documents
  id           uuid pk
  filename     text
  mime_type    text
  storage_path text                       -- relative path inside the 'secondary' bucket
  byte_size    int
  uploaded_at  timestamptz default now()

secondary_embeddings
  id           uuid pk
  document_id  uuid references secondary_documents on delete cascade
  chunk_index  int                        -- order within the document
  content      text                       -- the chunk text (or image caption)
  metadata     jsonb
  embedding    vector(1536)
  created_at   timestamptz default now()
  UNIQUE (document_id, chunk_index)
```

Plus two RPCs: `match_primary(query_embedding, match_count)` and `match_secondary(query_embedding, match_count)`, each returning `{id, content, metadata, similarity}` ordered by cosine distance.

Plus one private Supabase Storage bucket: `secondary`. Service-role only.

## File layout (new + modified)

**New files:**
```
supabase/
  rag_pipeline_migration.sql         — drops old embeddings, creates new schema + RPCs + storage policies
lib/
  embeddings.ts                      — OpenAI embed wrapper, chunker, primary-text builders
  file-extractors.ts                 — PDF/DOCX/TXT/MD/image extractors with a shared interface
components/
  SecondaryContextPanel.tsx          — floating panel, list + upload + delete + backfill
app/admin/
  rag-actions.ts                     — server actions for secondary docs + backfill
```

**Modified files:**
```
app/admin/actions.ts                 — wire embedRecord(...) into every create/update/delete + upsertSiteContent
app/api/chat/route.ts                — dual retrieval (match_primary + match_secondary)
app/layout.tsx                       — mount <SecondaryContextPanel /> inside EditModeProvider's tree
components/EditBar.tsx               — (optional) link to open the secondary panel
package.json                         — add pdf-parse, mammoth
.env.local.example                   — document required env vars (commit this; not .env.local)
CLAUDE.md                            — rewrite RAG section
scripts/embed.ts                     — delete
```

---

## Stage 1: Schema, storage bucket, dependencies

**Files:**
- Create: `supabase/rag_pipeline_migration.sql`
- Create: `.env.local.example`
- Modify: `package.json`
- Delete: `supabase/embeddings_migration.sql`, `scripts/embed.ts`

- [ ] **Step 1.1: Write the new migration SQL**

Create `supabase/rag_pipeline_migration.sql`:

```sql
-- One migration to set up the entire RAG pipeline. Idempotent: re-running
-- updates the RPCs and policies without re-creating populated data.
-- Apply once via Supabase SQL editor (or `supabase db push` if using the CLI).

create extension if not exists vector;

-- Drop the legacy single-table store from the static embed.ts era.
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

-- ── STORAGE BUCKET: 'secondary' ──────────────────────────────────────────
-- Private bucket; only service-role can read/write. Run via SQL editor;
-- bucket creation via raw SQL on Supabase uses the storage.buckets table.
insert into storage.buckets (id, name, public)
  values ('secondary', 'secondary', false)
  on conflict (id) do nothing;

-- No anon policies — service-role bypasses by default. If you ever want
-- anon read for direct-link previews, add a policy here.
```

- [ ] **Step 1.2: Create `.env.local.example`**

Create `.env.local.example` (commit this; it's the doc for what `.env.local` needs):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# RAG: chat completion model (free-tier-friendly)
DEEPSEEK_API_KEY=

# RAG: embeddings (text-embedding-3-small) and image captioning (gpt-4o-mini)
OPENAI_API_KEY=
```

- [ ] **Step 1.3: Delete legacy files**

```bash
git rm supabase/embeddings_migration.sql
git rm scripts/embed.ts
git rm scripts/seed.ts   # also legacy; inline editing replaces it
```

- [ ] **Step 1.4: Install dependencies**

```bash
npm install pdf-parse mammoth
npm install --save-dev @types/pdf-parse
```

`mammoth` ships its own TypeScript types. `pdf-parse` needs `@types/pdf-parse`.

- [ ] **Step 1.5: Commit**

```bash
git add supabase/rag_pipeline_migration.sql .env.local.example package.json package-lock.json
git rm supabase/embeddings_migration.sql scripts/embed.ts scripts/seed.ts
git commit -m "feat(rag): pipeline schema + deps; drop legacy single-store + scripts"
```

- [ ] **Step 1.6: Manual verification (one-time)**

Open Supabase SQL editor → paste `rag_pipeline_migration.sql` → run. Verify with:

```sql
select table_name from information_schema.tables
  where table_schema = 'public' and table_name like '%embedding%';
-- expect: primary_embeddings, secondary_embeddings (and secondary_documents)

select proname from pg_proc where proname like 'match_%';
-- expect: match_primary, match_secondary

select id from storage.buckets where id = 'secondary';
-- expect: one row
```

---

## Stage 2: Embedding core (`lib/embeddings.ts`)

Single module that owns:
1. The OpenAI embedding HTTP call.
2. Text chunking for long content.
3. Builders that take a row from each primary table and produce the text to embed.
4. The `embedRecord(...)` and `deleteRecord(...)` upsert/delete helpers used by server actions.

**Files:**
- Create: `lib/embeddings.ts`

- [ ] **Step 2.1: Write the OpenAI embed helper**

Create `lib/embeddings.ts`:

```ts
/**
 * RAG embedding core. All OpenAI calls live here, plus the chunkers and
 * primary-row → embedding-text builders. Server-only (uses service-role
 * Supabase client and OPENAI_API_KEY).
 */
import { adminClient } from "@/lib/supabase";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

/** Single-shot embed. Throws on non-2xx. */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  const v = json.data[0].embedding;
  if (v.length !== EMBED_DIM) throw new Error(`Unexpected embedding dim: ${v.length}`);
  return v;
}
```

- [ ] **Step 2.2: Add the chunker**

Append to `lib/embeddings.ts`:

```ts
/**
 * Greedy paragraph-aware chunker. Splits on blank lines first, then merges
 * paragraphs until adding the next one would exceed maxChars. Designed for
 * essays / PDFs — primary content rarely needs chunking and bypasses this.
 *
 * 1500 chars is well under text-embedding-3-small's 8191-token input limit
 * but gives enough overlap for paragraph-level semantic search.
 */
export function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (!buf) { buf = p; continue; }
    if (buf.length + 2 + p.length <= maxChars) {
      buf += "\n\n" + p;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}
```

- [ ] **Step 2.3: Add the primary-row text builders**

Append to `lib/embeddings.ts`:

```ts
import type { Project, Experience, Education } from "@/lib/types";

/** Builds the embed text for a project row. Order matters: most distinctive
 *  fields first so similarity ranks them strongly. */
export function buildProjectText(p: Project): string {
  const lines = [
    `Project: ${p.title}`,
    p.badge && `Type: ${p.badge}`,
    `Description: ${p.description}`,
    p.tags?.length ? `Tags: ${p.tags.join(", ")}` : null,
    p.links && Object.keys(p.links).length
      ? `Links: ${Object.entries(p.links).map(([k, v]) => `${k}=${v}`).join(", ")}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildExperienceText(e: Experience): string {
  const lines = [
    `Role: ${e.role} at ${e.org}`,
    `Type: ${e.type}`,
    `Dates: ${e.date_range}`,
    e.location && `Location: ${e.location}`,
    `Description: ${e.description}`,
    e.tags?.length ? `Tags: ${e.tags.join(", ")}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildEducationText(ed: Education): string {
  const concentrations = ed.concentrations?.length
    ? ` with concentrations in ${ed.concentrations.join(", ")}`
    : "";
  return `Education: ${ed.degree} at ${ed.school}${concentrations}.`;
}

export function buildSiteContentText(key: string, value: string): string {
  // site_content stores raw string/JSON; surface the key so RAG knows the
  // context (e.g. "hero.tagline" vs "contact.headline").
  return `[${key}] ${value}`;
}
```

- [ ] **Step 2.4: Add `embedRecord` and `deleteRecord` for primary**

Append to `lib/embeddings.ts`:

```ts
type PrimaryTable = "projects" | "experience" | "education" | "site_content";

/** Upserts a single primary_embeddings row. Idempotent on (source_table, source_id). */
export async function embedPrimary(
  source_table: PrimaryTable,
  source_id: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const embedding = await embedText(content);
  const { error } = await adminClient()
    .from("primary_embeddings")
    .upsert(
      { source_table, source_id, content, metadata, embedding, updated_at: new Date().toISOString() },
      { onConflict: "source_table,source_id" },
    );
  if (error) throw new Error(`embedPrimary upsert failed: ${error.message}`);
}

/** Removes a primary_embeddings row. Called from deleteProject etc. */
export async function deletePrimary(
  source_table: PrimaryTable,
  source_id: string,
): Promise<void> {
  const { error } = await adminClient()
    .from("primary_embeddings")
    .delete()
    .eq("source_table", source_table)
    .eq("source_id", source_id);
  if (error) throw new Error(`deletePrimary failed: ${error.message}`);
}
```

- [ ] **Step 2.5: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add lib/embeddings.ts
git commit -m "feat(rag): embedding core — OpenAI client, chunker, row→text builders, upsert helpers"
```

---

## Stage 3: File text extractors (`lib/file-extractors.ts`)

Server-side text extraction for secondary uploads. One function per supported MIME family; one dispatcher.

**Files:**
- Create: `lib/file-extractors.ts`

- [ ] **Step 3.1: Write the dispatcher + plain-text/MD extractors**

Create `lib/file-extractors.ts`:

```ts
/**
 * Server-side text extraction for secondary RAG documents. Each extractor
 * takes a Buffer + mime type and returns plain text to be chunked + embedded.
 *
 * Add a new file type by writing an extractor function and adding a case
 * in `extractText`. Returns null for unsupported types so the upload action
 * can refuse the file with a clear error.
 */
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "application/json",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type ExtractResult =
  | { kind: "text"; text: string }
  | { kind: "image"; bytes: Buffer; mime: string }
  | { kind: "unsupported"; reason: string };

export async function extractText(bytes: Buffer, mime: string): Promise<ExtractResult> {
  if (TEXT_MIMES.has(mime)) return { kind: "text", text: bytes.toString("utf8") };
  if (mime === PDF_MIME)    return { kind: "text", text: await extractPdf(bytes) };
  if (mime === DOCX_MIME)   return { kind: "text", text: await extractDocx(bytes) };
  if (IMAGE_MIMES.has(mime)) return { kind: "image", bytes, mime };
  return { kind: "unsupported", reason: `MIME type "${mime}" is not supported.` };
}

async function extractPdf(bytes: Buffer): Promise<string> {
  const parsed = await pdfParse(bytes);
  return parsed.text.trim();
}

async function extractDocx(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.trim();
}
```

- [ ] **Step 3.2: Add image captioning via gpt-4o-mini**

Append to `lib/file-extractors.ts`:

```ts
const CAPTION_MODEL = "gpt-4o-mini";

const CAPTION_PROMPT = `You are helping build a searchable knowledge base about a person named Rithvik.
Describe this image in detail in 2–4 sentences. Cover:
- What is depicted (subject, setting, mood).
- Any visible text, captions, labels, or handwriting (transcribe them).
- Any context clues about what the image relates to (a project, a place, a document, a moment).
Plain prose, no markdown.`;

/** Calls OpenAI Vision with the image bytes (base64) and returns a description
 *  that will be chunked + embedded like any other text source. */
export async function captionImage(bytes: Buffer, mime: string): Promise<string> {
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: CAPTION_MODEL,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: CAPTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Image caption failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const caption = json.choices[0]?.message?.content?.trim();
  if (!caption) throw new Error("Image caption returned empty content");
  return caption;
}
```

- [ ] **Step 3.3: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add lib/file-extractors.ts
git commit -m "feat(rag): file extractors — TXT/MD/PDF/DOCX text + image captioning via gpt-4o-mini"
```

---

## Stage 4: Wire primary auto-embedding into existing server actions

Every action in `app/admin/actions.ts` that mutates primary content gains a "save first, embed after" tail. Embedding failures are logged but do not undo the save — the panel will offer a manual "Re-embed all" recovery path.

**Files:**
- Modify: `app/admin/actions.ts`
- Create: `app/admin/rag-actions.ts` (backfill action)

- [ ] **Step 4.1: Add a safe-embed helper to actions.ts**

In `app/admin/actions.ts`, after the imports, add:

```ts
import { embedPrimary, deletePrimary, buildProjectText, buildExperienceText,
         buildEducationText, buildSiteContentText } from "@/lib/embeddings";

/**
 * Wraps an embedding call so it never throws into the caller. The DB write
 * has already succeeded by the time we call this; if embedding fails we log
 * and continue — the user's content is safe, RAG just won't see the latest
 * version of this row until "Re-embed all" runs.
 */
async function safeEmbed(label: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); }
  catch (e) { console.error(`[rag] ${label} embed failed:`, e instanceof Error ? e.message : e); }
}
```

- [ ] **Step 4.2: Hook embedding into the projects actions**

In `app/admin/actions.ts`, modify the three project actions:

```ts
export async function createProject(data: ProjectInput) {
  await requireAuth();
  const { data: created, error } = await adminClient()
    .from("projects")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${created.id}`, () =>
    embedPrimary("projects", created.id, buildProjectText(created),
                 { slug: created.slug, title: created.title }));
  return created;
}

export async function updateProject(id: string, data: ProjectInput) {
  await requireAuth();
  const { data: updated, error } = await adminClient()
    .from("projects").update(data).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${id}`, () =>
    embedPrimary("projects", id, buildProjectText(updated),
                 { slug: updated.slug, title: updated.title }));
}

export async function deleteProject(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${id} delete`, () => deletePrimary("projects", id));
}
```

- [ ] **Step 4.3: Hook embedding into the experience actions**

Mirror the pattern from Step 4.2 for `createExperience`, `updateExperience`, `deleteExperience` — substitute `buildExperienceText` and the source_table `'experience'`. Same `safeEmbed` wrapper.

- [ ] **Step 4.4: Hook embedding into education actions**

Education currently has `updateEducation` (and possibly create/delete). For each that exists, mirror Step 4.2 with `buildEducationText` and `'education'`. The `select().single()` after update returns the row we then pass into `buildEducationText`.

- [ ] **Step 4.5: Hook embedding into `upsertSiteContent`**

```ts
export async function upsertSiteContent(key: string, value: string) {
  await requireAuth();
  const { error } = await adminClient()
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`site_content ${key}`, () =>
    embedPrimary("site_content", key, buildSiteContentText(key, value), { key }));
}
```

- [ ] **Step 4.6: Write the backfill server action**

Create `app/admin/rag-actions.ts`:

```ts
"use server";
import { adminClient } from "@/lib/supabase";
import {
  embedPrimary, buildProjectText, buildExperienceText,
  buildEducationText, buildSiteContentText,
} from "@/lib/embeddings";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helper"; // see Step 4.7

/**
 * Re-embed every primary row from scratch. Wipes primary_embeddings, then
 * walks all four content tables and inserts a fresh row per record. Use:
 *   - After applying the initial schema migration (first-run setup).
 *   - If an inline-edit's embedding silently failed and content is now stale.
 * Returns a small report so the UI can show what happened.
 */
export async function backfillPrimaryEmbeddings(): Promise<{
  projects: number; experience: number; education: number; site_content: number;
  errors: string[];
}> {
  await requireAuth();
  const db = adminClient();
  const errors: string[] = [];

  await db.from("primary_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const counts = { projects: 0, experience: 0, education: 0, site_content: 0 };

  const { data: projects } = await db.from("projects").select("*").eq("published", true);
  for (const p of projects ?? []) {
    try {
      await embedPrimary("projects", p.id, buildProjectText(p), { slug: p.slug, title: p.title });
      counts.projects++;
    } catch (e) { errors.push(`project ${p.slug}: ${e instanceof Error ? e.message : e}`); }
  }

  const { data: experience } = await db.from("experience").select("*").eq("published", true);
  for (const e of experience ?? []) {
    try {
      await embedPrimary("experience", e.id, buildExperienceText(e), { slug: e.slug, org: e.org });
      counts.experience++;
    } catch (err) { errors.push(`experience ${e.slug}: ${err instanceof Error ? err.message : err}`); }
  }

  const { data: education } = await db.from("education").select("*").eq("published", true);
  for (const ed of education ?? []) {
    try {
      await embedPrimary("education", ed.id, buildEducationText(ed), { school: ed.school });
      counts.education++;
    } catch (err) { errors.push(`education ${ed.school}: ${err instanceof Error ? err.message : err}`); }
  }

  const { data: site } = await db.from("site_content").select("*");
  for (const row of site ?? []) {
    try {
      await embedPrimary("site_content", row.key, buildSiteContentText(row.key, row.value), { key: row.key });
      counts.site_content++;
    } catch (err) { errors.push(`site_content ${row.key}: ${err instanceof Error ? err.message : err}`); }
  }

  revalidatePath("/");
  return { ...counts, errors };
}
```

- [ ] **Step 4.7: Extract `requireAuth` into a shared file**

Currently `requireAuth` is defined inside `app/admin/actions.ts`. We need it from `rag-actions.ts` too. Create `app/admin/auth-helper.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Verifies an active session exists, redirects to / if not. */
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return user;
}
```

Then in `app/admin/actions.ts`, replace the inline `requireAuth` function definition with:

```ts
import { requireAuth } from "./auth-helper";
```

- [ ] **Step 4.8: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add app/admin/actions.ts app/admin/rag-actions.ts app/admin/auth-helper.ts
git commit -m "feat(rag): auto-embed primary content on every inline edit + backfill action"
```

---

## Stage 5: Secondary documents pipeline (server actions)

`app/admin/rag-actions.ts` gains three more actions: `uploadSecondaryDocument`, `deleteSecondaryDocument`, `listSecondaryDocuments`. Files land in the `secondary` Storage bucket; extracted/chunked text becomes rows in `secondary_embeddings` linked to a `secondary_documents` row.

**Files:**
- Modify: `app/admin/rag-actions.ts`

- [ ] **Step 5.1: Add `listSecondaryDocuments`**

Append to `app/admin/rag-actions.ts`:

```ts
import { chunkText, embedText } from "@/lib/embeddings";
import { extractText, captionImage } from "@/lib/file-extractors";

export interface SecondaryDocRow {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  uploaded_at: string;
  chunk_count: number;
}

/** Returns every secondary document with its chunk count for the UI list. */
export async function listSecondaryDocuments(): Promise<SecondaryDocRow[]> {
  await requireAuth();
  const db = adminClient();

  const { data: docs, error } = await db
    .from("secondary_documents")
    .select("id, filename, mime_type, byte_size, uploaded_at")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Count chunks per doc. One extra round-trip but avoids a view.
  const ids = (docs ?? []).map((d) => d.id);
  let countMap = new Map<string, number>();
  if (ids.length) {
    const { data: chunks } = await db
      .from("secondary_embeddings")
      .select("document_id")
      .in("document_id", ids);
    for (const c of chunks ?? []) {
      countMap.set(c.document_id, (countMap.get(c.document_id) ?? 0) + 1);
    }
  }
  return (docs ?? []).map((d) => ({ ...d, chunk_count: countMap.get(d.id) ?? 0 }));
}
```

- [ ] **Step 5.2: Add `uploadSecondaryDocument`**

Append to `app/admin/rag-actions.ts`:

```ts
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Accepts a single file from a <form action={uploadSecondaryDocument}>.
 * Steps:
 *  1. Validate (size, mime supported).
 *  2. Upload original bytes to the 'secondary' Storage bucket.
 *  3. Insert the secondary_documents row.
 *  4. Extract text (or caption if image), chunk it, embed each chunk.
 *  5. Insert secondary_embeddings rows.
 * If any step after the doc row insert fails, we delete the doc row (and the
 * cascade clears any embeddings already written). The Storage object is also
 * cleaned up on failure.
 */
export async function uploadSecondaryDocument(formData: FormData): Promise<SecondaryDocRow> {
  await requireAuth();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided.");
  if (file.size === 0) throw new Error("File is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const extracted = await extractText(bytes, mime);
  if (extracted.kind === "unsupported") throw new Error(extracted.reason);

  const db = adminClient();
  const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // 1) Upload original to Storage
  const { error: upErr } = await db.storage
    .from("secondary")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  // 2) Insert doc row
  const { data: doc, error: docErr } = await db
    .from("secondary_documents")
    .insert({ filename: file.name, mime_type: mime, storage_path: storagePath, byte_size: file.size })
    .select()
    .single();
  if (docErr) {
    await db.storage.from("secondary").remove([storagePath]);
    throw new Error(`Document insert failed: ${docErr.message}`);
  }

  // 3) Convert to embeddable text
  try {
    let chunks: string[];
    if (extracted.kind === "image") {
      const caption = await captionImage(extracted.bytes, extracted.mime);
      chunks = [caption]; // captions are short — no further splitting
    } else {
      chunks = chunkText(extracted.text);
      if (chunks.length === 0) throw new Error("No extractable text found in file.");
    }

    // 4) Embed + insert each chunk
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      const { error: embErr } = await db.from("secondary_embeddings").insert({
        document_id: doc.id,
        chunk_index: i,
        content: chunks[i],
        metadata: { filename: file.name, mime_type: mime },
        embedding,
      });
      if (embErr) throw new Error(`Embedding insert failed: ${embErr.message}`);
    }
  } catch (e) {
    // Roll back the doc row (cascade deletes any partial embeddings) + storage
    await db.from("secondary_documents").delete().eq("id", doc.id);
    await db.storage.from("secondary").remove([storagePath]);
    throw e;
  }

  // 5) Return the row shape the UI list expects
  const { data: chunkCount } = await db
    .from("secondary_embeddings")
    .select("id", { count: "exact", head: true })
    .eq("document_id", doc.id);
  void chunkCount;
  revalidatePath("/");
  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    byte_size: doc.byte_size,
    uploaded_at: doc.uploaded_at,
    chunk_count: 0, // UI re-fetches via listSecondaryDocuments after upload
  };
}
```

- [ ] **Step 5.3: Add `deleteSecondaryDocument`**

Append to `app/admin/rag-actions.ts`:

```ts
/** Removes the document, all its embeddings (via FK cascade), and the
 *  underlying Storage object. */
export async function deleteSecondaryDocument(id: string): Promise<void> {
  await requireAuth();
  const db = adminClient();
  const { data: doc, error: getErr } = await db
    .from("secondary_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (getErr) throw new Error(getErr.message);

  const { error: delErr } = await db.from("secondary_documents").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  // Best-effort storage delete — if it fails we've already lost the DB row;
  // the orphaned object is harmless.
  await db.storage.from("secondary").remove([doc.storage_path]);
  revalidatePath("/");
}
```

- [ ] **Step 5.4: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add app/admin/rag-actions.ts
git commit -m "feat(rag): secondary document upload/list/delete server actions"
```

---

## Stage 6: SecondaryContextPanel UI

A glass card that sits near the RAG launcher, only mounted when `isEditing === true`. Drag-drop or click-to-upload, lists existing docs with delete buttons, has a "Re-embed all primary content" button.

**Files:**
- Create: `components/SecondaryContextPanel.tsx`

- [ ] **Step 6.1: Skeleton + state + initial fetch**

Create `components/SecondaryContextPanel.tsx`:

```tsx
"use client";
import { useEffect, useState, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  listSecondaryDocuments,
  uploadSecondaryDocument,
  deleteSecondaryDocument,
  backfillPrimaryEmbeddings,
  type SecondaryDocRow,
} from "@/app/admin/rag-actions";
import { useEditMode } from "./EditModeProvider";

/**
 * Floating panel for managing the RAG bot's secondary context store.
 *
 * Only mounted when EditModeProvider says isEditing is true. Sits to the
 * left of the RAG chat launcher (bottom-right) so its association with the
 * bot is visually obvious. Three jobs:
 *   1. Show the current list of secondary documents with chunk counts.
 *   2. Accept new uploads (click or drag-drop), one at a time.
 *   3. Trigger a full re-embed of primary content when needed.
 */
export default function SecondaryContextPanel() {
  const { isEditing } = useEditMode();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<SecondaryDocRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);          // upload status text
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    refresh();
  }, [isEditing]);

  async function refresh() {
    try { setDocs(await listSecondaryDocuments()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  // ... (handlers added in next steps)

  if (!isEditing) return null;
  return null; // body added in Step 6.4
}
```

- [ ] **Step 6.2: Upload + delete + backfill handlers**

Replace the `// ... (handlers added in next steps)` comment with:

```tsx
  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const fd = new FormData();
        fd.set("file", file);
        await uploadSecondaryDocument(fd);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    await refresh();
  }

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}" from RAG context?`)) return;
    setError(null);
    setBusy(`Deleting ${filename}…`);
    try { await deleteSecondaryDocument(id); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
    await refresh();
  }

  async function handleBackfill() {
    if (!confirm("Re-embed all primary content? Existing primary embeddings will be replaced.")) return;
    setError(null);
    setBusy("Re-embedding primary content…");
    try {
      const report = await backfillPrimaryEmbeddings();
      const total = report.projects + report.experience + report.education + report.site_content;
      const summary = `Re-embedded ${total} primary rows (${report.projects}p / ${report.experience}e / ${report.education}ed / ${report.site_content}s).`;
      setBusy(report.errors.length ? `${summary} ${report.errors.length} error(s).` : summary);
      setTimeout(() => setBusy(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) startTransition(() => handleFiles(e.dataTransfer.files));
  }
```

- [ ] **Step 6.3: Render the launcher button + the expanded panel**

Replace the trailing `return null;` with:

```tsx
  return (
    <div className="ctx-launcher" aria-label="Secondary context panel">
      <AnimatePresence>
        {open && (
          <motion.div
            className="ctx-panel"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="ctx-header">
              <div className="ctx-title-group">
                <span className="ctx-title">RAG Context</span>
                <span className="ctx-subtitle">Secondary materials</span>
              </div>
              <button className="ctx-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className={`ctx-dropzone${dragOver ? " is-over" : ""}`}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept=".txt,.md,.pdf,.docx,image/*"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <button className="ctx-upload-btn" onClick={() => fileInputRef.current?.click()}>
                + Upload files
              </button>
              <p className="ctx-hint">Drag-and-drop or click — PDF, DOCX, TXT, MD, images.</p>
            </div>

            <ul className="ctx-list">
              {docs.length === 0 && <li className="ctx-empty">No secondary documents yet.</li>}
              {docs.map((d) => (
                <li key={d.id} className="ctx-item">
                  <div className="ctx-item-main">
                    <span className="ctx-item-name" title={d.filename}>{d.filename}</span>
                    <span className="ctx-item-meta">
                      {fmtBytes(d.byte_size)} · {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button className="ctx-item-del" onClick={() => handleDelete(d.id, d.filename)} aria-label={`Delete ${d.filename}`}>✕</button>
                </li>
              ))}
            </ul>

            <div className="ctx-footer">
              <button className="ctx-backfill" onClick={handleBackfill}>Re-embed all primary content</button>
              {busy  && <p className="ctx-status">{busy}</p>}
              {error && <p className="ctx-error">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="ctx-btn" onClick={() => setOpen((o) => !o)} aria-label="Manage RAG context">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
        <span>Context</span>
      </button>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
```

- [ ] **Step 6.4: Add the CSS**

Append to `app/globals.css` (after the existing `.rag-*` rules so the visual language matches):

```css
/* ===== SECONDARY CONTEXT PANEL =====
   Mirrors the RAG launcher visually — same glass / corner-radius / motion —
   but sits to its left so the two read as related controls. */

.ctx-launcher {
  position: fixed;
  bottom: 28px;
  right: 174px;            /* sits just left of the RAG launcher (RAG is at right:28) */
  z-index: 95;
}

.ctx-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 999px;
  font-family: var(--mono);
  font-size: 0.78rem;
  font-weight: 600;
  background: var(--panel-glass);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
  color: var(--text);
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
}
.ctx-btn:hover { border-color: color-mix(in srgb, var(--text) 20%, transparent); transform: translateY(-1px); }

.ctx-panel {
  position: absolute;
  bottom: calc(100% + 12px);
  right: 0;
  width: 360px;
  max-height: 540px;
  display: flex;
  flex-direction: column;
  background: var(--panel-glass);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0,0,0,0.4);
  overflow: hidden;
}

.ctx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
}
.ctx-title-group { display: flex; flex-direction: column; gap: 2px; }
.ctx-title { font-weight: 800; font-size: 0.9rem; letter-spacing: -0.02em; }
.ctx-subtitle { font-size: 0.68rem; color: var(--muted); font-family: var(--mono); }
.ctx-close {
  background: none; border: none; color: var(--muted);
  width: 28px; height: 28px; border-radius: 50%;
  cursor: pointer; transition: color 0.2s, background 0.2s;
}
.ctx-close:hover { color: var(--text); background: var(--card); }

.ctx-dropzone {
  padding: 14px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  transition: background 0.2s;
}
.ctx-dropzone.is-over { background: color-mix(in srgb, var(--accent) 8%, transparent); }
.ctx-upload-btn {
  width: 100%;
  padding: 8px 12px;
  font-family: var(--mono); font-size: 0.78rem; font-weight: 600;
  background: var(--card);
  border: 1px dashed color-mix(in srgb, var(--text) 20%, transparent);
  border-radius: 10px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.ctx-upload-btn:hover { background: var(--card-hover); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.ctx-hint { margin-top: 6px; font-size: 0.7rem; color: var(--muted); font-family: var(--mono); }

.ctx-list {
  list-style: none; padding: 6px 0; margin: 0;
  flex: 1; overflow-y: auto;
}
.ctx-empty { padding: 16px; text-align: center; color: var(--muted); font-size: 0.78rem; }
.ctx-item {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--text) 5%, transparent);
}
.ctx-item-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ctx-item-name {
  font-size: 0.82rem; font-weight: 600;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ctx-item-meta { font-size: 0.68rem; color: var(--muted); font-family: var(--mono); }
.ctx-item-del {
  background: none; border: none; color: var(--muted);
  width: 24px; height: 24px; border-radius: 50%;
  cursor: pointer; flex-shrink: 0;
  transition: color 0.2s, background 0.2s;
}
.ctx-item-del:hover { color: var(--accent); background: var(--card-hover); }

.ctx-footer {
  padding: 12px 16px;
  border-top: 1px solid color-mix(in srgb, var(--text) 8%, transparent);
  display: flex; flex-direction: column; gap: 6px;
}
.ctx-backfill {
  padding: 8px 12px;
  font-family: var(--mono); font-size: 0.74rem; font-weight: 600;
  background: var(--card);
  border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  border-radius: 8px;
  color: var(--text);
  cursor: pointer;
  transition: background 0.2s;
}
.ctx-backfill:hover { background: var(--card-hover); }
.ctx-status { font-size: 0.72rem; color: var(--muted); font-family: var(--mono); }
.ctx-error  { font-size: 0.72rem; color: var(--accent); font-family: var(--mono); }
```

- [ ] **Step 6.5: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add components/SecondaryContextPanel.tsx app/globals.css
git commit -m "feat(rag): SecondaryContextPanel — drag-drop upload, list/delete, backfill"
```

---

## Stage 7: Mount the panel (edit-mode-only)

**Files:**
- Modify: `app/page.tsx` (or `app/layout.tsx` if the panel should live across all pages — for v1 the page is single-route so either works; pick `app/page.tsx` to keep it next to `<RagBot />`)

- [ ] **Step 7.1: Mount conditionally**

In `app/page.tsx`, add the import near `RagBot`:

```tsx
import SecondaryContextPanel from "@/components/SecondaryContextPanel";
```

And in the JSX, render it as a sibling of `<RagBot />`:

```tsx
      <SecondaryContextPanel />
      <RagBot />
```

`SecondaryContextPanel` self-gates on `useEditMode()`, so it renders `null` when not editing — no conditional wrapper needed at the caller.

- [ ] **Step 7.2: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add app/page.tsx
git commit -m "feat(rag): mount SecondaryContextPanel next to RagBot"
```

---

## Stage 8: Dual retrieval in the chat route

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 8.1: Replace single retrieval with parallel primary + secondary**

Replace the existing retrieval block (currently calls `match_embeddings`) with:

```ts
// Parallel retrieval: top 3 from each context store.
const [{ data: primaryChunks }, { data: secondaryChunks }] = await Promise.all([
  adminClient().rpc("match_primary",   { query_embedding: embedding, match_count: 3 }),
  adminClient().rpc("match_secondary", { query_embedding: embedding, match_count: 3 }),
]);

const primaryText = (primaryChunks as { content: string }[] ?? [])
  .map((c) => c.content).join("\n\n");
const secondaryText = (secondaryChunks as { content: string }[] ?? [])
  .map((c) => c.content).join("\n\n");

const contextBlock = [
  primaryText   && `## What's on the website:\n${primaryText}`,
  secondaryText && `## Background materials (essays, documents Rithvik has shared):\n${secondaryText}`,
].filter(Boolean).join("\n\n");
```

Then in the existing `systemPrompt` template, replace the trailing `Context:\n${context}` with `Context:\n${contextBlock}`.

Optionally tweak the system prompt to mention both sources — change the "HOW TO ANSWER" bullet to:

```
- Two kinds of context are provided: "What's on the website" (objective facts about Rithvik's projects/experience/education/contact) and "Background materials" (essays and documents Rithvik has shared — useful for character, values, motivations). Use both; cite which one you drew from if it changes the tone of the answer.
```

- [ ] **Step 8.2: Typecheck and commit**

```bash
node_modules/.bin/tsc --noEmit
git add app/api/chat/route.ts
git commit -m "feat(rag): dual retrieval — parallel match_primary + match_secondary in chat route"
```

---

## Stage 9: Cleanup, docs, manual QA

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 9.1: Rewrite the RAG section in CLAUDE.md**

Replace the existing "RAG bot" section under "High-level architecture" with:

```markdown
### RAG bot (`components/RagBot.tsx`, `components/SecondaryContextPanel.tsx`, `app/api/chat/route.ts`)

A floating "Ask RAG" launcher in the bottom-right (mounted in `app/page.tsx`). Clicking opens a glass chat panel; messages stream from `/api/chat` token-by-token. A second launcher to its left — `SecondaryContextPanel` — only appears in edit mode and manages the bot's secondary knowledge.

Two parallel pgvector stores in Supabase:
- `primary_embeddings` — one row per `projects` / `experience` / `education` / `site_content` record. Auto-updated by `app/admin/actions.ts` on every inline edit (save first, then `embedPrimary(...)` in a `safeEmbed` wrapper so OpenAI failures don't undo saves). `match_primary(query_embedding, match_count)` RPC returns top-N by cosine similarity.
- `secondary_embeddings` — chunks from files Rithvik uploads via `SecondaryContextPanel`. Tied to `secondary_documents` rows that track filename/mime/storage path. PDFs use `pdf-parse`, DOCX uses `mammoth`, plain text reads UTF-8 directly, images get captioned by `gpt-4o-mini` and the caption is embedded. `match_secondary(query_embedding, match_count)` mirrors the primary RPC.

`app/api/chat/route.ts` embeds the user query (`text-embedding-3-small`), calls both `match_primary` and `match_secondary` in parallel (top 3 each), builds a labeled context block ("What's on the website" / "Background materials"), and streams completions from DeepSeek (`deepseek-chat`).

Originals of secondary uploads live in the private `secondary` Supabase Storage bucket. RLS denies anon access to all three RAG tables; the chat route and server actions reach them via `adminClient()` (service-role).

Env vars in `.env.local`: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. See `.env.local.example`.

**One-time setup:** apply `supabase/rag_pipeline_migration.sql` in the Supabase SQL editor, then enter edit mode and hit "Re-embed all primary content" in the secondary-context panel. After that, every inline edit keeps primary in sync automatically, and uploads keep secondary in sync.
```

- [ ] **Step 9.2: Update the Database section in CLAUDE.md**

Replace the `embeddings` line with:

```markdown
- `primary_embeddings` — pgvector store for website content. One row per content record; auto-upserted on inline edits. Service-role only (RLS denies all).
- `secondary_documents` — file metadata for user-uploaded RAG materials (filename, mime, storage path, byte size).
- `secondary_embeddings` — pgvector store for chunks extracted from secondary documents. Linked to `secondary_documents` via FK with `on delete cascade`.
```

And replace the `embeddings_migration.sql` line in "Migration files" with:

```markdown
- `supabase/rag_pipeline_migration.sql` — pgvector extension + the two embedding tables + `secondary_documents` + both RPCs + RLS lockdown + Storage bucket. Apply once; the rest is UI-driven.
```

- [ ] **Step 9.3: Update file-layout cheat sheet**

Add to the `lib/` block:
```
  embeddings.ts       — OpenAI embed wrapper, chunker, row→text builders, upsert helpers
  file-extractors.ts  — PDF/DOCX/TXT/MD readers + gpt-4o-mini image captioner
```

Add to `components/`:
```
  SecondaryContextPanel.tsx  — edit-mode-only panel: list/upload/delete secondary docs + backfill
```

Add under `app/admin/`:
```
    rag-actions.ts    — server actions: backfillPrimaryEmbeddings, list/upload/delete secondary docs
    auth-helper.ts    — shared requireAuth (used by actions.ts and rag-actions.ts)
```

Remove the `scripts/` block (we deleted both files).

- [ ] **Step 9.4: Update triage section**

Replace the three RAG triage rows with:

```markdown
- RAG returns 500 "Embedding failed" → `OPENAI_API_KEY` missing or quota-exhausted. The chat-completion model is DeepSeek; only embeddings + image captioning use OpenAI.
- RAG answers feel stale after edits → confirm `safeEmbed` isn't silently failing in the server logs (it catches embedding errors and logs `[rag] ... embed failed`). Recovery: edit-mode → SecondaryContextPanel → "Re-embed all primary content".
- Upload fails with "MIME type … not supported" → add the type to `TEXT_MIMES`/`IMAGE_MIMES` or write a new extractor branch in `lib/file-extractors.ts`.
- match_primary / match_secondary not found → `rag_pipeline_migration.sql` wasn't applied, or was applied to a different Supabase project than the one in `.env.local`.
- Secondary panel doesn't appear → check `useEditMode().isEditing`. The panel self-gates; if you're not logged in via `InlineLoginPanel` it won't render.
```

- [ ] **Step 9.5: Manual end-to-end QA**

Run these in order against the dev preview (or local `npm run dev`):

```
1. Apply rag_pipeline_migration.sql via Supabase SQL editor.
2. Verify env vars: OPENAI_API_KEY, DEEPSEEK_API_KEY, SUPABASE_SERVICE_ROLE_KEY all set.
3. Open the site, log in via the "I am Rithvik" inline panel.
4. Open the new Context panel (bottom-right, just left of "Ask RAG"). Confirm it only appears in edit mode.
5. Click "Re-embed all primary content". Confirm the summary line reports nonzero counts for projects/experience/education/site_content.
6. Verify in Supabase: `select count(*) from primary_embeddings;` returns the same total.
7. Edit one project's description via the inline UI. Save. Confirm in Supabase that the row's updated_at on primary_embeddings advanced.
8. Upload a TXT file (e.g. a paragraph essay) via the Context panel. Confirm it appears in the list with a chunk count.
9. Upload a PDF. Same checks.
10. Upload an image (e.g. a screenshot). Confirm chunk_count = 1; query Supabase to see the caption text in secondary_embeddings.content.
11. Open the RAG bot. Ask a question that should pull from primary ("What projects has Rithvik built?"). Verify the answer is grounded in the actual project rows.
12. Ask a question that should pull from secondary (e.g. about content from the essay you uploaded). Verify it cites that material.
13. Delete one secondary doc from the panel. Confirm it's gone from secondary_documents AND secondary_embeddings (cascade) AND the Storage bucket.
14. Log out. Confirm Context panel disappears.
```

- [ ] **Step 9.6: Commit and push**

```bash
node_modules/.bin/tsc --noEmit
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for new RAG pipeline architecture"
git push origin dev
```

---

## Extensibility cheat sheet (for future-Rithvik)

| To add a new… | Touch | What changes |
|---|---|---|
| Primary content table | `lib/embeddings.ts` (add a new `buildXText` function); `app/admin/actions.ts` (wire `safeEmbed` into the new actions); `rag-actions.ts` (add to backfill loop); migration (extend the `check` constraint on `source_table`). | Auto-embedding kicks in immediately. |
| Secondary file type | `lib/file-extractors.ts` (extend `extractText`'s dispatch + add the extractor function); UI `accept=` attribute on the file input. | Supported transparently. |
| Different chat model | `app/api/chat/route.ts` — swap the `ChatOpenAI` baseURL/model. Embeddings unchanged. | Single-line change. |
| Different embedding model | Change `EMBED_MODEL` + `EMBED_DIM` in `lib/embeddings.ts`, change `vector(1536)` → `vector(NEW_DIM)` in the migration. Run "Re-embed all primary content" + re-upload secondaries. | Two files + a re-run. |
| Top-K change | `app/api/chat/route.ts` — change the `match_count` arg per RPC. | Single-line per source. |
| Whole-row metadata in retrieval | Already in `metadata jsonb`. Surface it in the prompt by mapping `chunks.map(c => `[${c.metadata.title}] ${c.content}`)`. | One-line tweak. |

## Self-review checklist

- ✅ Primary auto-embed on every inline edit (Stage 4, all four actions).
- ✅ Secondary upload UI with multi-format support — TXT/MD/PDF/DOCX/images (Stages 3, 5, 6).
- ✅ Image handling via gpt-4o-mini caption then embed (Stage 3 + Stage 5).
- ✅ View + delete UI for secondary docs (Stage 6).
- ✅ Panel only in edit mode, near RAG launcher (Stage 6 + Stage 7).
- ✅ Top-3 from each source in retrieval (Stage 8).
- ✅ No terminal scripts required post-setup — backfill is a server action (Stage 4) wired to a UI button (Stage 6).
- ✅ "Save first, embed after" via `safeEmbed` wrapper.
- ✅ Two-table schema with parallel `match_primary` / `match_secondary` RPCs.
- ✅ Extensibility points documented in the cheat sheet above.
- ✅ Type names consistent throughout: `SecondaryDocRow`, `ExtractResult`, `embedPrimary`/`deletePrimary`, `buildProjectText` etc. used identically wherever they appear.

---

## Execution

Plan saved here. When you're ready to implement, you can either:

1. **Subagent-driven (recommended)** — I dispatch one fresh subagent per task, review between, fast iteration.
2. **Inline execution** — Execute tasks in this session with checkpoints for review.

Just say the word.
