/**
 * Pure, dependency-free recursive text splitter with overlap.
 * Extracted from lib/embeddings.ts so it can be unit-tested without pulling
 * in the Supabase admin client or any environment variables.
 */

/** Soft target size for each chunk (characters). */
export const CHUNK_TARGET = 900;

/** Overlap size prepended to each chunk from the tail of the previous one (chars). */
export const CHUNK_OVERLAP = 150;

/**
 * Hard upper bound: any piece longer than this is recursed into with a
 * finer-grained separator before it is emitted as a chunk.
 */
export const CHUNK_HARD_MAX = 1200;

/**
 * Separator hierarchy, coarsest-to-finest.  The splitter tries each level in
 * turn, recursing into any resulting piece that still exceeds CHUNK_HARD_MAX.
 */
const SEPARATORS: string[] = ["\n\n", "\n", ". ", "? ", "! ", " "];

/**
 * Skip ahead to the first space so the overlap starts on a whole word.
 */
function snapToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const region = text.slice(text.length - maxLen);
  // Walk forward past any partial word at the start of the region.
  const spaceIdx = region.indexOf(" ");
  // If there's no space the whole region is one token; keep it whole.
  return spaceIdx === -1 ? region : region.slice(spaceIdx + 1);
}

/**
 * Recursive separator-hierarchy text splitter with overlap.
 *
 * Splits `text` into chunks targeting CHUNK_TARGET chars, with CHUNK_OVERLAP
 * chars of tail-of-previous prepended to each subsequent chunk (snapped to a
 * word boundary).  Any piece that exceeds CHUNK_HARD_MAX is recursed into
 * using finer-grained separators before being emitted.
 *
 * @param text     - Source text to split.
 * @param maxChars - Soft target per chunk (defaults to CHUNK_TARGET = 900).
 *                   Kept for backward compatibility; CHUNK_HARD_MAX remains fixed.
 */
export function chunkText(text: string, maxChars = CHUNK_TARGET): string[] {
  // Normalize the text; empty / whitespace-only input returns nothing.
  const normalized = text.trim();
  if (!normalized) return [];

  // Use the caller-supplied value (clamped) as the greedy-pack target;
  // CHUNK_HARD_MAX remains the fixed recursion guard.
  const target = Math.min(maxChars, CHUNK_HARD_MAX);

  // Run the recursive split using the module-level CHUNK_HARD_MAX cap.
  // We produce raw, non-overlapping chunks first, then inject overlap below.
  const rawChunks = splitRecursiveWithTarget(normalized, 0, target);

  if (rawChunks.length <= 1) return rawChunks;

  // Inject overlap: prepend the tail of the previous raw chunk onto the start
  // of each subsequent chunk, snapped to a word boundary.
  const result: string[] = [rawChunks[0]];
  for (let i = 1; i < rawChunks.length; i++) {
    const prev = rawChunks[i - 1];
    // Cap overlap so that overlap + " " + rawChunk[i] never exceeds CHUNK_HARD_MAX.
    const maxOverlap = Math.max(0, CHUNK_HARD_MAX - rawChunks[i].length - 1);
    const overlap = snapToWordBoundary(prev, Math.min(CHUNK_OVERLAP, maxOverlap));
    // Prepend the overlap only if it's non-empty and not already present.
    result.push(overlap ? overlap + " " + rawChunks[i] : rawChunks[i]);
  }

  return result;
}

/**
 * Recursive helper for chunkText. Splits text at SEPARATORS[sepIdx], greedily
 * packs pieces up to `target` chars, and recurses into pieces that still
 * exceed CHUNK_HARD_MAX.
 */
function splitRecursiveWithTarget(text: string, sepIdx: number, target: number): string[] {
  if (text.length <= CHUNK_HARD_MAX) return [text];

  const sep = SEPARATORS[sepIdx];

  if (sep === undefined) {
    const result: string[] = [];
    for (let i = 0; i < text.length; i += target) {
      result.push(text.slice(i, i + target));
    }
    return result;
  }

  const parts = text.split(sep).filter((p) => p.trim().length > 0);

  if (parts.length <= 1) return splitRecursiveWithTarget(text, sepIdx + 1, target);

  const chunks: string[] = [];
  let buf = "";

  for (const part of parts) {
    const subParts =
      part.length > CHUNK_HARD_MAX
        ? splitRecursiveWithTarget(part, sepIdx + 1, target)
        : [part];

    for (const sub of subParts) {
      if (!buf) {
        buf = sub;
        continue;
      }
      const candidate = buf + sep + sub;
      if (candidate.length <= target) {
        buf = candidate;
      } else {
        chunks.push(buf);
        buf = sub;
      }
    }
  }

  if (buf) chunks.push(buf);
  return chunks;
}
