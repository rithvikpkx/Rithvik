import { test } from "node:test";
import assert from "node:assert/strict";
// Import from the pure splitter module so no Supabase/env deps are needed.
// chunkText is re-exported from lib/embeddings.ts for backward compat.
import { chunkText, CHUNK_HARD_MAX } from "./chunk-text.ts";

// Helpers
function makeBlob(words: number): string {
  // A single space-separated blob with no blank lines, long enough to force splitting.
  return Array.from({ length: words }, (_, i) => `word${i}`).join(" ");
}

// ------------------------------------------------------------------
// 1. A blank-line-free blob longer than CHUNK_HARD_MAX splits into multiple chunks.
// ------------------------------------------------------------------
test("long blob without blank lines produces multiple chunks", () => {
  const blob = makeBlob(500); // well over 1200 chars
  const chunks = chunkText(blob);
  assert.ok(chunks.length > 1, `expected multiple chunks, got ${chunks.length}`);
});

// ------------------------------------------------------------------
// 2. Every returned chunk's length ≤ CHUNK_HARD_MAX.
// ------------------------------------------------------------------
test("all chunks respect CHUNK_HARD_MAX", () => {
  const blob = makeBlob(500);
  const chunks = chunkText(blob);
  for (const chunk of chunks) {
    assert.ok(
      chunk.length <= CHUNK_HARD_MAX,
      `chunk of length ${chunk.length} exceeds CHUNK_HARD_MAX (${CHUNK_HARD_MAX}): "${chunk.slice(0, 60)}..."`,
    );
  }
});

// ------------------------------------------------------------------
// 3. Consecutive chunks share overlapping text (at least one shared word).
// ------------------------------------------------------------------
test("consecutive chunks share overlap words", () => {
  const blob = makeBlob(500);
  const chunks = chunkText(blob);
  assert.ok(chunks.length >= 2, "need at least 2 chunks to test overlap");
  for (let i = 0; i < chunks.length - 1; i++) {
    const tailWords = chunks[i].split(/\s+/).slice(-5); // last 5 words of this chunk
    const headText = chunks[i + 1];
    const shared = tailWords.some((w) => w.length > 2 && headText.includes(w));
    assert.ok(
      shared,
      `chunks[${i}] and chunks[${i + 1}] share no words — overlap missing`,
    );
  }
});

// ------------------------------------------------------------------
// 4. No source content is lost: stripping the overlap, the unique words
//    cover all original words in order.
// ------------------------------------------------------------------
test("all original words are covered (no content loss)", () => {
  // Use a blob that has real sentence-style words so deduplication is meaningful.
  const words = Array.from({ length: 300 }, (_, i) => `uniqueword${i}`);
  const blob = words.join(" ");
  const chunks = chunkText(blob);

  // Collect all words across all chunks, deduplicating consecutive repeats
  // (overlap regions will have identical words appearing at chunk boundaries).
  const seen = new Set<string>();
  const covered: string[] = [];
  for (const chunk of chunks) {
    for (const w of chunk.split(/\s+/).filter(Boolean)) {
      if (!seen.has(w)) {
        seen.add(w);
        covered.push(w);
      }
    }
  }

  // Every original word must appear.
  for (const w of words) {
    assert.ok(seen.has(w), `original word "${w}" is missing from chunks`);
  }

  // Words appear in the original order (overlap causes duplicates, not reordering).
  let srcIdx = 0;
  for (const w of covered) {
    assert.equal(w, words[srcIdx], `word order mismatch at covered[${srcIdx}]`);
    srcIdx++;
  }
});

// ------------------------------------------------------------------
// 5. Short input (shorter than target) returns exactly one chunk.
// ------------------------------------------------------------------
test("short input returns exactly one chunk", () => {
  const short = "This is a very short sentence.";
  const chunks = chunkText(short);
  assert.equal(chunks.length, 1, `expected 1 chunk for short input, got ${chunks.length}`);
  assert.equal(chunks[0], short);
});

// ------------------------------------------------------------------
// 6. Empty / whitespace-only input returns [].
// ------------------------------------------------------------------
test("empty input returns empty array", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   "), []);
  assert.deepEqual(chunkText("\n\n  \n"), []);
});

// ------------------------------------------------------------------
// 7. Overlap-over-cap edge: raw chunks near CHUNK_HARD_MAX must not grow
//    past CHUNK_HARD_MAX after overlap injection.
// ------------------------------------------------------------------
test("overlap injection never pushes a chunk past CHUNK_HARD_MAX", () => {
  // Two ~1200-char blobs of 30-char words separated by a single space.
  // Each blob is separator-free, so it becomes one raw chunk right at the cap.
  // Naively prepending 150 chars of overlap would produce a 1351-char chunk.
  const word30 = "w".repeat(29); // 29 chars + space = 30 chars/word
  const wordsPerBlob = Math.ceil(CHUNK_HARD_MAX / 30); // ~40 words ≈ 1200 chars
  const blob = Array.from({ length: wordsPerBlob }, () => word30).join(" ")
    + " "
    + Array.from({ length: wordsPerBlob }, () => word30).join(" ");
  const chunks = chunkText(blob);
  assert.ok(chunks.length > 1, "expected multiple chunks from two large blobs");
  for (const chunk of chunks) {
    assert.ok(
      chunk.length <= CHUNK_HARD_MAX,
      `overlap-inflated chunk of length ${chunk.length} exceeds CHUNK_HARD_MAX (${CHUNK_HARD_MAX})`,
    );
  }
});

// ------------------------------------------------------------------
// 8. maxChars compat parameter: chunkText(blob, 300) uses 300 as the
//    greedy-pack target and never exceeds CHUNK_HARD_MAX.  Because maxChars
//    is a soft pack target (not an overlap cap), post-overlap chunks may
//    slightly exceed maxChars but must never exceed CHUNK_HARD_MAX, and there
//    should be more chunks than the default 900-char run.
// ------------------------------------------------------------------
test("maxChars parameter produces more chunks and stays within CHUNK_HARD_MAX", () => {
  const blob = makeBlob(500); // well over 1200 chars
  const chunksDefault = chunkText(blob);
  const chunksSmall = chunkText(blob, 300);
  // Smaller target → more chunks.
  assert.ok(
    chunksSmall.length > chunksDefault.length,
    `expected more chunks with maxChars=300 (${chunksSmall.length}) than with default (${chunksDefault.length})`,
  );
  // Hard invariant still holds.
  for (const chunk of chunksSmall) {
    assert.ok(
      chunk.length <= CHUNK_HARD_MAX,
      `chunk of length ${chunk.length} exceeds CHUNK_HARD_MAX (${CHUNK_HARD_MAX}): "${chunk.slice(0, 60)}..."`,
    );
  }
});
