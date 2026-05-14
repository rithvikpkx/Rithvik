# RAG Pipeline — Architectural Reference

> **Audience:** future-Rithvik or anyone returning to this codebase wanting to understand or modify the chatbot. Assumes familiarity with the Next.js / Supabase / TypeScript stack but not with RAG itself.
>
> **Scope:** what the system does, why each component exists, how the pieces connect, the failure modes we hit getting here, and the levers for extending it.

---

## TL;DR

A two-source Retrieval-Augmented Generation chatbot. Sources are:

- **Primary**: every editable piece of content on the website (`projects`, `experience`, `education`, `site_content` rows in Supabase). Auto-embedded on every inline edit.
- **Secondary**: files Rithvik uploads through a UI panel only visible in edit mode (essays, PDFs, DOCX, images). Stored in Supabase Storage; text or image-caption is chunked + embedded.

On every chat turn the route runs a five-step pipeline:

```
question  ──→  HyDE expansion (gpt-4o-mini)  ──→  combined embed (text-embedding-3-small, 1536d)
                                                              │
                                                              ▼
                          ┌──────────── Promise.allSettled ────────────┐
                          │                                              │
                          ▼                                              ▼
              match_primary (top 10)                       match_secondary (top 10)
                          │                                              │
                          └──────────── empty-context guard ─────────────┘
                                                  │ both non-empty
                                                  ▼
                          Labeled context block (recent convo + primary + secondary)
                                                  │
                                                  ▼
                          gpt-4o-mini stream completion (with refusal-or-grounded system prompt)
                                                  │
                                                  ▼
                                       text/plain SSE-style stream → client
```

Cost: **~$0.0008 per chat turn**, dominated by chat completion. A few hundred turns/month is well under $1.

---

## The two data stores

### `primary_embeddings`

```sql
primary_embeddings (
  id           uuid PK,
  source_table text CHECK (source_table IN ('projects','experience','education','site_content')),
  source_id    text,
  content      text,
  metadata     jsonb,
  embedding    vector(1536),
  updated_at   timestamptz,
  UNIQUE (source_table, source_id)
);

CREATE INDEX primary_embeddings_embedding_idx
  ON primary_embeddings USING hnsw (embedding vector_cosine_ops);
```

- **One row per content row.** A project edit upserts (not inserts) its corresponding embedding row, keyed on `(source_table, source_id)`. The unique constraint is what makes `safeEmbed` idempotent on every save.
- **`source_id` is `text`, not `uuid`,** because `site_content`'s primary key is a string key (`hero.tagline`, `bento.stack`, etc.) — projects/experience/education use UUIDs but they fit in `text` fine.
- **`metadata jsonb`** carries per-table identifying info: `{slug, title}` for projects, `{slug, org}` for experience, `{school}` for education, `{key}` for site_content. Not currently surfaced in retrieval but available for future use (filtering by table, citing source, etc.).
- **HNSW index, not IVFFlat.** This is the most important schema decision in the whole pipeline. See [Failure mode: IVFFlat under-probing](#failure-mode-ivfflat-under-probing) below.

### `secondary_documents` + `secondary_embeddings`

```sql
secondary_documents (
  id           uuid PK,
  filename     text,
  mime_type    text,
  storage_path text UNIQUE,
  byte_size    int,
  uploaded_at  timestamptz
);

secondary_embeddings (
  id           uuid PK,
  document_id  uuid REFERENCES secondary_documents ON DELETE CASCADE,
  chunk_index  int,
  content      text,
  metadata     jsonb,
  embedding    vector(1536),
  created_at   timestamptz,
  UNIQUE (document_id, chunk_index)
);
```

Two-table design because a single uploaded file can produce many chunks (especially PDFs). The FK + cascade means deleting a `secondary_documents` row wipes all its embeddings atomically.

Original file bytes live in the private `secondary` Supabase Storage bucket so they can be re-processed later if chunking strategy changes.

### RLS

All three tables: `enable row level security` + `deny all` policy. The chat route and inline-edit actions reach them via `adminClient()` (service-role key), which bypasses RLS. Anonymous PostgREST requests can't see or modify anything. This is the right posture — there's nothing in these tables that's safe to expose anonymously.

---

## Component map

```
                ┌─────────────────────────────────────────────────────────────┐
                │                          BROWSER                            │
                │                                                             │
                │  RagBot.tsx                  SecondaryContextPanel.tsx      │
                │  (always visible)            (edit-mode only)               │
                │       │                              │                      │
                │       │ POST /api/chat               │ uploadSecondary-     │
                │       │   { message, messages }      │   Document(FormData) │
                │       ▼                              ▼                      │
                └───────┼──────────────────────────────┼──────────────────────┘
                        │                              │
                        ▼                              ▼
                ┌───────────────────────┐    ┌────────────────────────────┐
                │  app/api/chat/        │    │  app/admin/                │
                │    route.ts           │    │    rag-actions.ts          │
                │                       │    │    actions.ts              │
                │  • HyDE               │    │                            │
                │  • embed              │    │  • backfillPrimary…        │
                │  • match_primary      │    │  • list/upload/delete      │
                │  • match_secondary    │    │      Secondary…            │
                │  • build context      │    │  • create/update/delete    │
                │  • stream completion  │    │      Project/Experience/   │
                │                       │    │      Education + upsert    │
                │                       │    │      SiteContent           │
                └─────────┬─────────────┘    └──────────────┬─────────────┘
                          │                                  │
                          ▼                                  ▼
                ┌───────────────────────┐    ┌────────────────────────────┐
                │  lib/embeddings.ts    │    │  lib/file-extractors.ts    │
                │                       │    │                            │
                │  • embedText          │    │  • extractText (dispatch)  │
                │  • generateHypo…      │    │  • extractPdf (unpdf)      │
                │  • chunkText          │    │  • extractDocx (mammoth)   │
                │  • buildProjectText   │    │  • captionImage (gpt-4o-   │
                │  • build…Text         │    │      mini Vision)          │
                │  • embedPrimary       │    │                            │
                │  • deletePrimary      │    │                            │
                └─────────┬─────────────┘    └──────────────┬─────────────┘
                          │                                  │
                          └──────────────┬───────────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │  Supabase                   │
                          │                             │
                          │  primary_embeddings         │
                          │  secondary_embeddings       │
                          │  secondary_documents        │
                          │  Storage: 'secondary'       │
                          │  RPCs: match_primary,       │
                          │        match_secondary      │
                          └─────────────────────────────┘
```

### Module responsibilities

| File | Responsibility |
|---|---|
| `lib/embeddings.ts` | All OpenAI calls (embed, HyDE), text-to-prose builders, upsert/delete helpers, paragraph chunker. |
| `lib/file-extractors.ts` | Server-only file parsers (PDF / DOCX / TXT / MD / image captioning). Returns a `{kind, text\|bytes}` tagged union to the upload action. |
| `app/admin/auth-helper.ts` | Shared `requireAuth()` consumed by both server-action files. `import "server-only"` so accidental client imports fail at build time. |
| `app/admin/actions.ts` | The existing content-editing server actions, now with embedding tails. Wraps every embed call in `safeEmbed` so the save never fails because of an OpenAI hiccup. |
| `app/admin/rag-actions.ts` | RAG-specific server actions: `backfillPrimaryEmbeddings`, `listSecondaryDocuments`, `uploadSecondaryDocument`, `deleteSecondaryDocument`. |
| `app/api/chat/route.ts` | The retrieval-and-generation pipeline. The only consumer of `match_primary` / `match_secondary`. |
| `components/RagBot.tsx` | Floating chat launcher, streaming UI. Always visible. |
| `components/SecondaryContextPanel.tsx` | Edit-mode-only panel for managing secondary uploads + triggering backfill. Self-gates on `useEditMode().isEditing`. |
| `supabase/rag_pipeline_migration.sql` | Schema: tables, HNSW indexes, RPCs, RLS, Storage bucket. Idempotent; safe to re-run. |

---

## The "write path" — how content reaches the embedding stores

### Primary content (inline edits)

Every server action in `app/admin/actions.ts` that mutates a content row follows the same five-step shape:

```ts
await requireAuth();
const { data: row, error } = await adminClient().from(table).insert/update/delete(...).select().single();
if (error) throw new Error(error.message);
revalidate();
await safeEmbed(label, () => syncPrimary(table, row, () => buildText(row), metadata));
```

Key design choices:

1. **Save first, embed after.** The DB write succeeds before we even touch OpenAI. If embedding fails, the row is already in Supabase. `safeEmbed` catches the error, logs `[rag] <label> embed skipped: <msg>`, and returns — never throws into the caller. The user's save is sacrosanct; RAG visibility for that one row degrades gracefully until backfill or the next edit.

2. **`syncPrimary` respects the `published` flag** for `projects`/`experience`/`education`. If `row.published === true`, upsert the embedding. If `false`, delete it. This keeps RAG visibility in sync with public-site visibility — flipping a project to draft removes it from the bot's knowledge.

3. **`site_content` bypasses `syncPrimary`** because it has no `published` column. `upsertSiteContent` always calls `embedPrimary` directly. Every site_content key is always RAG-visible.

4. **`select().single()` after every update.** We embed from the persisted row, not the input — this picks up DB defaults, generated columns, `updated_at` triggers, etc.

5. **Upsert is idempotent** on `(source_table, source_id)`. The same row can be re-embedded a hundred times without producing duplicates. This is what makes both per-action embeds AND the wipe-and-rebuild backfill coexist cleanly.

### Backfill (one-time setup + recovery)

`backfillPrimaryEmbeddings` is the panel's "Re-embed all primary content" button. It wipes the table and re-walks every published row across all four content tables, calling `embedPrimary` for each. Used:

- **First-run setup** after the schema migration is applied.
- **Recovery** if a series of inline-edit embeddings silently failed (e.g., during an OpenAI outage).
- **After changes to chunk-text builders** (`buildProjectText` etc.) — to refresh existing embeddings with the new format.

Returns a structured report — counts per table + an `errors[]` array — so the panel can show a summary line.

### Secondary content (file uploads)

`uploadSecondaryDocument(formData)` is the upload action. The flow is:

```
1. requireAuth + validate (size ≤ 20MB, file present)
2. Buffer.from(await file.arrayBuffer())
3. extractText(bytes, mime) → ExtractResult discriminated union
     ├─ {kind:"text"}      — TXT/MD/JSON/PDF/DOCX
     ├─ {kind:"image"}     — PNG/JPEG/WebP/GIF
     └─ {kind:"unsupported"} → throw with reason

4. Upload original bytes to Storage bucket 'secondary'
     (failure → throw with rollback of nothing yet)

5. INSERT secondary_documents row
     (failure → DELETE Storage object, throw)

6. Inside try block:
     - if image: captionImage(bytes, mime) → chunks = [caption]
     - else: chunks = chunkText(text)
     - if chunks.length > MAX_CHUNKS_PER_DOC (200): throw early
     - for each chunk: embedText(content) → INSERT secondary_embeddings row
   (any failure inside this block → DELETE doc row (cascades embeddings) + DELETE Storage object, rethrow)

7. revalidate + return SecondaryDocRow with actual chunk_count
```

Why this exact ordering: **the cheapest-to-orphan resource is committed first.** A leaked Storage blob is harmless (we'd never reference it). A leaked DB row would be — it'd show up in `listSecondaryDocuments` as a phantom doc. So we commit Storage, then DB, then embeddings; on failure we walk back in reverse.

### Image captioning

Images are special. Pgvector only handles text embeddings. So instead of trying to embed image content directly:

1. Send the image bytes (as base64 data URL) + a tightly-scoped prompt to `gpt-4o-mini` Vision.
2. The prompt asks for a 2–4 sentence description covering subject, any visible text (transcribed), and context clues.
3. That caption text is then treated as the chunk content — embedded and stored like any other text.

Cost is ~$0.0003 per image. The caption is in `secondary_embeddings.content`, so when retrieval surfaces it, the chat model sees the caption, not the image.

---

## The "read path" — how a question becomes an answer

This is the core of `app/api/chat/route.ts`. Walking through it:

### Step 1: Input validation

```ts
if (!message || message.trim().length === 0) return 400;
if (message.length > MAX_INPUT_LENGTH /* 500 */) return 400;
```

Prevents empty queries (would waste an OpenAI call) and absurdly long ones (which would also defeat the embedding model's input cap).

### Step 2: HyDE expansion

```ts
const hypothetical = await generateHypotheticalAnswer(message);
const queryForEmbedding = `${message}\n\n${hypothetical}`;
const embedding = await embedText(queryForEmbedding);
```

This is the single most impactful retrieval-quality lever in the pipeline.

**Why it matters:** the embedding model places statement-form text and question-form text in different parts of the vector space. The chunks in our stores are statement-form ("Rithvik Praveen Kumar studies at Purdue University..."). A bare question like "where did rithvik study?" doesn't embed close to them — instead it embeds close to other questions about people, which we don't have.

**How HyDE works:** before retrieval, ask `gpt-4o-mini` for a *plausible* 1–2 sentence answer to the question. We don't care if the hypothetical is factually correct — it's never shown to the user, only embedded. The hypothetical is in statement form, so its embedding lands close to the chunks we actually want. By concatenating the question and the hypothetical and embedding the combination, we get the best of both worlds: question intent + statement-form proximity.

**Fallback behavior:** `generateHypotheticalAnswer` catches every error path (missing key, API failure, malformed response) and returns the raw question as a fallback. Retrieval still works, just with weaker question-form recall. The chat never breaks because of HyDE.

### Step 3: Parallel retrieval

```ts
const [primaryRes, secondaryRes] = await Promise.allSettled([
  db.rpc("match_primary",   { query_embedding: embedding, match_count: 10 }),
  db.rpc("match_secondary", { query_embedding: embedding, match_count: 10 }),
]);
```

Three things to note:

- **`Promise.allSettled`, not `Promise.all`.** If one source's RPC throws (missing function, network blip, RLS regression), we want to answer from the other source rather than 500 the request.
- **Both RPCs in parallel.** Cuts latency from sequential 2× round trips to a single 1× round trip.
- **`match_count: 10`.** For a small corpus (~17 primary chunks today, growing slowly), top-10 is "most of the corpus" — basically every meaningfully-relevant chunk lands in the cut. The trade-off is more tokens in the prompt; at ~150 chars per chunk that's still well under any sensible context budget.

Both results pass through `unpack(label, res)`, which:

- Logs `[rag] <label> rpc threw:` if the promise rejected (network / library error).
- Logs `[rag] <label> rpc error:` if the in-band `error` field is set (PostgREST returned 4xx/5xx).
- Returns `[]` in either failure path.
- Otherwise returns the typed chunks.

The result: any single-source failure is logged loudly AND degrades to an empty array, so the bot still answers from whatever worked.

### Step 4: Empty-context guard

```ts
if (primaryChunks.length === 0 && secondaryChunks.length === 0) {
  console.warn(`[rag] empty-context guard fired for query: ${message.slice(0, 80)}`);
  return streamText(CANNED_NO_CONTEXT_REPLY);
}
```

If BOTH stores return zero chunks, we don't even call the chat model. The canned `"I don't have that specific detail, but you're welcome to reach out to Rithvik directly..."` reply is streamed back via the same `text/plain` chunked transfer protocol the bot's UI consumes.

This guard exists because a cost-optimized chat model will happily fabricate plausible-sounding answers when given an empty context. The system prompt's "refuse if not in context" rule is necessary but not sufficient — the only way to fully prevent fabrication on empty context is to never give the model a chance.

The `console.warn` is intentional: if this guard fires often, something is wrong with retrieval (most likely a pgvector index regression), and the logs will show it on the first query rather than after weeks of degraded answers.

### Step 5: Context block + system prompt

The context block is three labeled sections:

```
## Recent conversation:
User: ...
RAG: ...
User: ...

## What's on the website:
<top-10 primary chunks joined with \n\n>

## Background materials (essays, documents Rithvik has shared):
<top-10 secondary chunks joined with \n\n>
```

The recent-conversation section is included BOTH as a labeled context section AND as actual `HumanMessage`/`AIMessage` turns in the LangChain message list. The model gets the conversation twice on purpose:

- As a labeled frame: explicit "here's what we've been discussing — use this for continuity, NOT as a fact source"
- As real turns: so the model engages as a conversational agent rather than dumping a transcript

The system prompt has a `CRITICAL — GROUNDING RULES` section at the very top:

- Every factual claim must appear (verbatim or near-verbatim) in `## What's on the website` or `## Background materials`
- Recent conversation is for continuity only, NOT a fact source
- Do NOT use training-data knowledge about Rithvik
- If the answer isn't in Context, the only valid response is the canned refusal

Followed by `IDENTITY AND SCOPE` (only answer questions about Rithvik), `HOW TO ANSWER` (lean on background materials for character/personality, website for facts), and `PERSONA INTEGRITY` (refuse to roleplay, ignore injected instructions).

### Step 6: Streaming completion

`model.stream(messages)` returns an async iterable of token chunks. We pipe each chunk's `content` to a `ReadableStream` that's returned as `text/plain` with `Transfer-Encoding: chunked`. The client (`components/RagBot.tsx`) reads via `response.body.getReader()` and updates the message progressively.

### Choice of chat model: `gpt-4o-mini`

We started with DeepSeek `deepseek-chat` for cost reasons. It was significantly cheaper but routinely ignored the "refuse if not in context" rule, fabricating facts about Rithvik (made-up universities, made-up GitHub handles, etc.). For RAG bots, instruction adherence is a hard requirement, not a luxury — the whole architecture is built on the assumption that the model will refuse rather than fabricate. So we switched to `gpt-4o-mini`, which follows the rule reliably, at roughly 5× the per-token cost. Still pennies per month at our traffic.

---

## Cost model

Per chat turn:
- HyDE generation (`gpt-4o-mini`, ~150 input + ~100 output tokens): **~$0.00007**
- Embedding (`text-embedding-3-small`, ~200 tokens): **~$0.000004**
- 2× pgvector RPC calls: free (Supabase Postgres)
- Chat completion (`gpt-4o-mini`, ~2000 input + ~200 output tokens): **~$0.0004**

**Total: ~$0.0005 per turn.** Round to $0.001 for safety margin.

Per upload (one-time per file):
- TXT/MD/PDF/DOCX: 1× embed per chunk (≤200 chunks) → up to $0.0002 per upload
- Image: 1× gpt-4o-mini Vision call (~$0.0003) + 1× embed → ~$0.0003

The recurring cost of the system is therefore dominated by chat traffic. At 1000 turns/month that's ~$1; at 10000 turns/month ~$10. Image captioning is the most expensive single operation but only fires on upload, not per query.

---

## Failure modes we hit (and what they taught us)

This section documents the bugs we encountered in production so future-you doesn't re-discover them. Each one cost real debugging time.

### Failure mode: IVFFlat under-probing

The original migration created the pgvector indexes as:

```sql
CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

Pgvector's published heuristic is `lists ≈ sqrt(rows)`, which is fine *at scale*. With our day-one population of 17 chunks, 100 clusters meant each cluster held an average of 0.17 rows. The default `ivfflat.probes = 1` searched a single cluster per query, almost always returning the seed row alone — or nothing.

**Symptom:** the chat bot would fabricate wildly because retrieval was silently returning empty arrays. The system prompt's refusal rule wasn't strong enough to overcome the model's tendency to fill blanks with training-data plausibilities. Every answer was a different invented school name.

**Root-cause path:** added debug logging to the route, saw `primaryChunks count: 0` despite the table having 17 rows. Direct-tested the RPC via the Supabase CLI: 17 rows in the table, RPC asks for top-3, gets back 1. Tried `SET ivfflat.probes = 100` — got back all 17. Diagnosis confirmed.

**Fix:** drop IVFFlat, use HNSW. HNSW has no row-count-dependent tuning parameter, works at any scale, doesn't need per-session `probes` setting.

```sql
CREATE INDEX ... USING hnsw (embedding vector_cosine_ops);
```

**Lesson:** the pgvector docs' tuning guidance assumes you have enough rows for the heuristic to make sense. For small corpora (or unknown growth profiles), prefer HNSW.

### Failure mode: `pdf-parse` DOMMatrix crash on Vercel

Initial implementation used `pdf-parse@2.x`. It typechecked, built fine locally, and worked end-to-end during local testing. After deploying to Vercel:

```
ReferenceError: DOMMatrix is not defined
  at module evaluation (.next/server/chunks/ssr/[root-of-the-server]__0j_4qb.._.js:24:117538)
```

The crash was at **module evaluation** of the server bundle on any POST to `/`. Every server action was broken, not just PDF upload. The home page (statically generated) loaded fine, but inline edits and any other server-action call failed.

**Why local builds passed:** my local Node was 25. Node 25 exposes `DOMMatrix` in `node:vm` and through some internal paths. Vercel's Node 22 runtime doesn't expose `DOMMatrix` at all. `pdf-parse@2` transitively loads `pdfjs-dist`, which references `DOMMatrix` at the top of its module — so importing `lib/file-extractors.ts` (which loads `pdf-parse`) crashed before any of our code ran.

**Surprise insight:** Vercel bundles routes separately. The `/api/chat` endpoint was in a different bundle than the server-actions bundle, so chat worked even though edits didn't. "Bot is alive" ≠ "everything works."

**Fix:** swap `pdf-parse` for `unpdf`. Same `pdfjs-dist` underneath, but ships the polyfills needed for serverless Node. API is also cleaner: `extractText(bytes, { mergePages: true }) → { text: string }`. Simpler than pdf-parse v2's class API.

**Lesson:** any package that touches PDF rendering may pull in browser-only globals via its dependencies. For Vercel Functions / serverless Node, prefer libraries explicitly designed for that runtime.

### Failure mode: cost-optimized models fabricate

`deepseek-chat` is cheap and capable on benchmarks but doesn't follow the "refuse if not in context" rule reliably. Across runs of the SAME query ("where did rithvik study?") it answered "Penn State," "Michigan," and "Maryland" — each plausible but each wrong.

We pushed the system prompt harder: bullet → numbered list → ALL-CAPS critical section at the top → explicit refusal verbiage. DeepSeek kept inventing. After moving to `gpt-4o-mini` with the same prompt, the model refuses correctly when context lacks the answer.

**Lesson:** for grounded-answer-or-refuse RAG patterns, instruction adherence is non-negotiable. Test the model on adversarial questions (questions whose answers aren't in your corpus) before committing.

### Failure mode: question form vs statement form

Even with retrieval working (HNSW fixed) and the model behaving (gpt-4o-mini), the bot would sometimes still hallucinate. Investigation: for queries like "where did rithvik study?", the top-5 chunks returned didn't include the actual education row. The education chunk read `Education: B.S. in Computer Science...` — clean and concise, but **as a statement starting with a label**, it didn't embed close to a **question starting with "where"**.

**Two-pronged fix:**

1. **Question-anchored chunks.** Rewrote `buildEducationText` (and the other builders) to use natural prose with Rithvik's name as a subject anchor: `Rithvik Praveen Kumar studies at Purdue University, where he is pursuing a B.S. in Computer Science...`. Subject + verb makes the chunk semantically richer; embedding model has more to work with. Also added a `SITE_CONTENT_LABELS` map so site_content keys like `bento.stack` become readable phrases ("Rithvik's tech stack and technologies he works with") instead of opaque dotted keys.

2. **HyDE expansion.** Instead of embedding the raw question, generate a 1–2 sentence hypothetical answer with `gpt-4o-mini`, then embed the concatenation of `question \n\n hypothetical_answer`. The hypothetical is in statement form, so the combined embedding lands close to actual statement-form chunks even when the bare question doesn't.

Both were needed. Either alone improved retrieval slightly; together they fixed it.

**Lesson:** treat embedding similarity as "different forms of the same idea may live in different parts of the vector space." Question→statement is a common asymmetry. Either pre-process your chunks to be question-friendly, or pre-process your queries to be chunk-friendly. HyDE does the latter without requiring re-embedding.

### Failure mode: silent retrieval failure → confident hallucination

Underlying everything above is one operational pattern worth naming: **a RAG system that returns empty context plus a chat model that doesn't strictly refuse will produce confident, plausible, wrong answers**. The user can't distinguish "the bot doesn't know" from "the bot is making things up" because the latter sounds natural.

The defenses we landed on, in layers:

1. **Strong index choice** (HNSW) prevents the empty-context case from happening often.
2. **`unpack` helper** distinguishes thrown errors from in-band errors from empty results, logs everything loudly.
3. **Empty-context guard** in the route short-circuits the LLM entirely if both sources return zero. The user gets the canned refusal; the logs get a `[rag] empty-context guard fired` warning.
4. **System prompt CRITICAL section** at the top of the prompt: explicit refusal rule, no-fabrication rule.
5. **Model choice** (gpt-4o-mini) that actually obeys the refusal rule.

Each layer catches what the layer below missed. The cost of being aggressive about defense-in-depth here is small (a few extra `console.warn`s, one extra `if`), and the cost of skipping it was three hours of user-visible hallucination.

---

## Extending the system

The pipeline is designed to be extended without architectural changes. Common cases:

### New primary content table

1. Add `<NewTable>Input` interface to `app/admin/actions.ts`.
2. Add `create<NewTable>` / `update<NewTable>` / `delete<NewTable>` actions following the `safeEmbed`+`syncPrimary` pattern.
3. Add `build<NewTable>Text(row)` to `lib/embeddings.ts`.
4. Extend the `PrimaryTable` union literal and the `source_table` CHECK constraint in the migration.
5. Add the new table to the backfill loop in `backfillPrimaryEmbeddings`.

### New secondary file type

1. Add the MIME type to the appropriate constant set in `lib/file-extractors.ts` (`TEXT_MIMES`, `IMAGE_MIMES`, or a new `XYZ_MIME`).
2. If it needs custom extraction, add an `extractXyz(bytes: Buffer)` function and a new dispatch branch in `extractText`.
3. Add the file extension to the `accept` attribute of the file input in `SecondaryContextPanel.tsx`.

### Different chat model

`new ChatOpenAI({...})` in `route.ts`. Change `modelName`, optionally `apiKey` and `configuration.baseURL` for an OpenAI-compatible provider. HyDE and image-captioning calls in `lib/embeddings.ts` and `lib/file-extractors.ts` are separate — they can stay on `gpt-4o-mini` even if the main chat moves.

### Different embedding model

Change `EMBED_MODEL` + `EMBED_DIM` in `lib/embeddings.ts`, change `vector(1536) → vector(N)` in the migration, re-run the migration (DDL change), click "Re-embed all primary content" in the panel and re-upload secondary docs. The new dimension propagates through naturally.

### Different top-K

`MATCH_COUNT_PER_SOURCE` in `route.ts`. One line.

### Stronger retrieval (Tier 2 ideas, not yet implemented)

If/when the corpus grows past ~few hundred chunks and retrieval quality matters more:

- **Cross-encoder reranker.** Pull top-20 chunks via vector search, send them + the question to a cross-encoder (Cohere `rerank-english-v3.0`, or self-rerank via `gpt-4o-mini`), keep top-5 by relevance score. Cross-encoders score query-chunk *pairs* together rather than embedding them separately, so they catch relevance signals that pure vector similarity misses.
- **Hybrid search (BM25 + vector).** Add Postgres FTS on `content` columns; union with vector top-K; rerank the merged set. Catches exact-match cases (specific project names, technologies) that vector similarity sometimes fuzzes over.
- **Pre-generated Q&A index.** For each content row, use the LLM to generate ~20 likely questions; embed each question alongside the canonical chunk. Retrieval becomes question-to-question matching, which is dramatically more accurate. Worth it if you start seeing failures on specific common question phrasings.

None of these are needed today. The current Tier 1 + HyDE setup is sufficient for the corpus size and traffic.

---

## Operational notes

### One-time setup (after a fresh DB or schema reset)

1. Apply `supabase/rag_pipeline_migration.sql` via Supabase SQL editor or `supabase db query --linked -f supabase/rag_pipeline_migration.sql`.
2. Set env vars on Vercel (and `.env.local` for local dev): `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy.
4. Open the site, log in via "I am Rithvik," click the **Context** launcher (bottom-right, left of "Ask RAG"), click **"Re-embed all primary content."** Confirm the summary line shows non-zero counts.
5. Optionally upload secondary materials (essays, etc.) via the same panel.

### Routine operation

- **Inline edits keep primary in sync automatically.** No action needed.
- **New secondary content**: upload via the panel.
- **Refresh stale embeddings** (after editing chunk-text builders, for example): click backfill.

### When to re-embed

- After modifying any `build*Text` function in `lib/embeddings.ts`.
- After changing the embedding model.
- After a series of inline edits where Vercel logs show repeated `[rag] ... embed skipped` warnings.

### What lives where

- **DB rows**: source of truth for content (projects, experience, etc.).
- **`primary_embeddings`**: derived view of the DB, kept in sync by `safeEmbed`. Can always be rebuilt from the DB via backfill.
- **`secondary_documents` + `secondary_embeddings`**: NOT derived from anything else — these are the source of truth for uploaded content.
- **`secondary` Storage bucket**: original file blobs, kept for potential re-processing (e.g., if chunking strategy changes).

Deleting and rebuilding `primary_embeddings` is always safe. Deleting `secondary_documents` permanently loses user-uploaded content (the chunks cascade, and we don't reprocess from Storage — we'd need a separate reprocessing job for that).

---

## What's intentionally NOT in this system

So future-you doesn't wonder why these are missing:

- **No automated tests.** Repo-wide convention is `tsc --noEmit` + visual verification + Vercel preview. Tests for prompts and embeddings are hard to write meaningfully anyway.
- **No vector-store migration framework.** The schema lives in one SQL file; changes are made directly to the live DB via `supabase db query --linked -f` (or the SQL editor). For a single-author project this is fine; if this ever grows, consider the Supabase migrations directory pattern.
- **No streaming embedding pipeline.** Embeds are synchronous in server actions (save first, embed after, in the same request). Trade-off: ~300ms added latency on save vs. complexity of a background job queue. Accepted for our scale.
- **No reranker, hybrid search, or Q&A index.** Mentioned above as Tier-2 extensions; not implemented today because HyDE + question-anchored chunks + gpt-4o-mini's instruction adherence already cover the common cases.
- **No retrieval caching.** Every chat turn does HyDE → embed → 2× RPCs. At our traffic the per-turn cost is negligible; caching would add complexity for ~zero savings.
- **No multi-language support.** Embeddings are language-aware but our chunks and prompts are English-only. Not a blocker; would only matter if the audience expanded.
- **No streaming HyDE.** HyDE generation is `await`ed in full before retrieval starts. Adds ~300ms to first-byte latency. Could be skipped via a heuristic ("is the query short and question-form?") but the value of always-HyDE outweighs the latency cost.

---

## Quick reference

| Thing | Where |
|---|---|
| The full retrieval flow | `app/api/chat/route.ts` |
| HyDE generator | `lib/embeddings.ts → generateHypotheticalAnswer` |
| Embedding wrapper | `lib/embeddings.ts → embedText` |
| Per-table chunk text | `lib/embeddings.ts → build*Text` |
| File extractors | `lib/file-extractors.ts → extractText, extractPdf, extractDocx, captionImage` |
| Server actions for content | `app/admin/actions.ts` |
| Backfill + secondary CRUD | `app/admin/rag-actions.ts` |
| Auth helper | `app/admin/auth-helper.ts` |
| Schema + indexes + RPCs | `supabase/rag_pipeline_migration.sql` |
| Chat UI | `components/RagBot.tsx` |
| Upload + backfill UI | `components/SecondaryContextPanel.tsx` |
| Top-K, max-input, etc. | Constants at the top of `app/api/chat/route.ts` |
| Implementation plan (history) | `plans/feat-rag-pipeline.md` |
