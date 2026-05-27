# RAG Rebalance — Secondary Chunking + Tiered Grounding

**Date:** 2026-05-26
**Status:** Design — approved, pending implementation plan

## Problem

The RAG chatbot under-answers questions that require any synthesis, and it cannot
draw on the rich "character / values / motivation" material in the uploaded essays.
Two independent root causes:

1. **Secondary context is one un-retrievable blob.** The entire 28,538-char
   secondary PDF (`Rithvik.ai - Secondary Context (05-2026) - First round.pdf` —
   Common App essay, full résumé, UML/BU/Columbia essays) is stored as a **single**
   `secondary_embeddings` row. `chunkText` (`lib/embeddings.ts`) splits **only on
   blank lines** (`\n\s*\n`) and **never hard-splits an oversized paragraph**.
   `unpdf` with `mergePages: true` returns the PDF as space-separated text with
   essentially no blank-line breaks, so the splitter sees one paragraph and emits
   one chunk just under the embed token limit. One chunk → one averaged vector →
   no retrieval granularity (matches everything weakly or nothing).

2. **The grounding prompt forbids extrapolation.** `app/api/chat/route.ts` requires
   every claim to appear "verbatim or near-verbatim" in context and makes the canned
   refusal the *only valid reply* when something isn't present. This was added to
   stop DeepSeek hallucinating; with `gpt-4o-mini` it now over-suppresses legitimate
   reasoning over present context. (Temperature is not the cause — it is unset, i.e.
   LangChain's default 0.7.)

## Goals

- Secondary documents are chunked into retrievable, overlapping units so passages
  (e.g. the "12 Angry Men" story, GPA, awards) are individually matchable.
- The chatbot performs light, grounded extrapolation (themes, strengths, inferences)
  while never inventing hard facts (names, dates, links, handles, numbers).
- The fix generalizes to future uploads, not just the current PDF.

## Non-goals

- Changing the primary store (it is healthy — 26 clean statement-form rows).
- Changing the retrieval RPCs, HNSW indexes, or HyDE.
- Adding new runtime dependencies.
- Removing the empty-context guard.

---

## Part 1 — Recursive splitter (`lib/embeddings.ts`)

Rewrite `chunkText(text, maxChars)` into a recursive separator-hierarchy splitter
with overlap. The function name and its single call site (`uploadSecondaryDocument`
in `app/admin/rag-actions.ts`) are preserved; image captions still bypass it.

**Algorithm**
- Separator hierarchy, tried largest → finest: `"\n\n"` → `"\n"` → sentence breaks
  (`. ` / `? ` / `! `) → `" "` (space) → hard character window (last resort).
- Greedily pack pieces toward a **target ~900 chars**; if a single piece exceeds a
  **hard cap (~1200 chars)**, recurse into it using the next-finer separator.
- After chunk boundaries are decided, add **~150-char overlap**: prepend the tail of
  the previous chunk to the next, snapped to a word boundary so no word is cut.

**Constants** (module-level, named): `CHUNK_TARGET = 900`, `CHUNK_OVERLAP = 150`,
`CHUNK_HARD_MAX = 1200`. `maxChars` parameter retained for back-compat, defaulting to
`CHUNK_TARGET`.

**Outcome**
- Current PDF: 1 chunk → ~25–35 overlapping chunks, well under
  `MAX_CHUNKS_PER_DOC = 200`.
- No text is dropped; ideas straddling a boundary survive via overlap.

**Unit test** (`lib/embeddings.test.ts`, `node:test`, mirroring
`lib/sanitize-html.test.ts`; run with
`node --experimental-strip-types --test lib/embeddings.test.ts`):
- A blank-line-free blob longer than `CHUNK_HARD_MAX` splits into multiple chunks.
- Every chunk length ≤ `CHUNK_HARD_MAX`.
- Consecutive chunks share overlapping text (≥ 1 shared word).
- Concatenating chunks (de-duplicating overlap) loses no source content.
- Short input (< target) returns exactly one chunk.
- Empty / whitespace-only input returns `[]`.

> Note: the test imports only `chunkText` (a pure function). It must not import the
> Supabase admin client path, to stay runnable without env/network.

---

## Part 2 — Re-chunk action (`app/admin/rag-actions.ts` + `SecondaryContextPanel`)

The original files remain in the `secondary` Storage bucket, so re-processing needs
no re-upload.

**New server action** `reembedSecondaryDocuments()` (mirrors
`backfillPrimaryEmbeddings`):
1. `requireAuth()`.
2. List all `secondary_documents`.
3. For each doc: download bytes from the `secondary` bucket via `storage_path`;
   re-run `extractText` (text docs re-extracted, images re-captioned via
   `captionImage`); re-chunk with the new splitter (images → single caption chunk,
   unchanged); **delete that doc's existing `secondary_embeddings`**; insert fresh
   chunks with `chunk_index` reset from 0.
4. Honor `MAX_CHUNKS_PER_DOC`; on a per-doc failure, record it in `errors` and
   continue to the next doc (do not abort the whole run).
5. Return `{ documents: number, chunks: number, errors: string[] }`.
6. `revalidatePath("/")`.

**UI** — add a **"Re-chunk all secondary docs"** button to `SecondaryContextPanel`
beside the existing "Re-embed all primary content" button, showing the returned
counts / errors the same way the backfill button does.

**Failure handling:** a download or extraction failure for one doc must not wipe its
existing embeddings — delete-then-insert happens only once new chunks are
successfully produced for that doc.

---

## Part 3 — Tiered grounding prompt (`app/api/chat/route.ts`)

Rewrite the `CRITICAL — GROUNDING RULES` and `HOW TO ANSWER` sections into two
explicit tiers. Leave `IDENTITY AND SCOPE`, `FORMATTING`, and `PERSONA INTEGRITY`
unchanged.

**Tier 1 — Facts (verbatim-only).** Names, schools, employers, job titles, dates,
locations, technologies, links, handles, and numbers must appear in context and are
never invented or guessed. (Preserves the anti-hallucination protection.)

**Tier 2 — Interpretation (allowed when grounded).** The model MAY:
- Summarize or synthesize themes across the provided materials (especially the
  essays in "Background materials").
- Characterize strengths, values, motivations, and working style when clearly
  supported by context.
- Connect two grounded facts into a reasonable observation.
- Draw light inferences that a reader would agree follow from the provided context.

**Refusal reframed.** Refuse (with the canned reply) only when a *specific factual
detail* is genuinely absent — NOT when the answer merely requires reasoning over
facts that ARE present.

**Worked examples** embedded in the prompt (2–3), e.g.:
- *Allowed:* "What kind of engineer is Rithvik?" → synthesize persistence (HFH
  story), teaching, and applied-AI/BCI interest from context.
- *Allowed:* connect "built a RAG platform at Hack The Future" + "building rithvik.ai
  with a RAG bot" → "he has repeated hands-on RAG experience."
- *Not allowed:* stating a GPA, employer, date, or handle that does not appear in
  context.

**Temperature.** Set explicitly on the `ChatOpenAI` model (currently unset →
implicit 0.7). Start at `0.7` (documented as a tuning knob); bump toward `0.8` only
if answers still feel stiff after the prompt change.

**Empty-context guard.** Unchanged — it fires only when BOTH stores return zero rows,
which is a genuine "nothing to ground on" case and becomes rarer after re-chunking.

---

## Why the two halves reinforce each other

The résumé's GPA 4.0, phone, Data Mine community, and awards currently sit *inside*
the single un-retrievable blob. After Part 1 they become individually retrievable;
Part 3 then lets the bot both *state* them (Tier 1) and *reason* about them (Tier 2,
e.g. "a strong academic record alongside hands-on TinyML research").

## Verification

- `node_modules/.bin/tsc --noEmit` clean.
- `node --experimental-strip-types --test lib/embeddings.test.ts` passes.
- `eslint` clean on touched files; `next build` succeeds.
- Manual: run "Re-chunk all secondary docs" in edit mode, confirm the panel reports
  ~25–35 chunks for the PDF; query the chatbot with a personality/values question and
  a résumé-detail question (GPA, awards) and confirm grounded, non-refusing answers.
- Vercel `dev` preview renders and the chat route streams correctly.

## Files touched

- `lib/embeddings.ts` — rewrite `chunkText` + constants.
- `lib/embeddings.test.ts` — new unit test.
- `app/admin/rag-actions.ts` — new `reembedSecondaryDocuments()`.
- `components/SecondaryContextPanel.tsx` — re-chunk button.
- `app/api/chat/route.ts` — tiered grounding prompt + explicit temperature.
- `CLAUDE.md` — update the RAG section (chunking strategy, re-chunk action, grounding
  tiers) after implementation.
