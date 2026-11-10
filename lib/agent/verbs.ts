/** The working line's rotating verbs: a few that say what the agent really does, a few from the owner's world (the ouroboros,
 *  Purdue, the stack, the dots). Pure; the caller supplies the random source so tests are deterministic. */

export const VERBS = [
  "Recursing", "Swallowing its tail", "Ouroborosing", "Retrieving", "Augmenting", "Grounding", "Embedding", "Reading the resume",
  "Boilerplating", "Spinning the 78", "Centering the div", "Counting the dots", "Approximating angles", "Tinkering", "Shipping",
  "Compiling at Purdue", "Pruning tensors", "Quantizing", "Indexing", "Citing sources", "Chunking", "Rewriting the question",
  "Warming up the shaders", "Tuning the hyperparameters",
];

/** Two or three extra verbs for a look, mixed into the same shuffle so they turn up now and then. */
export const FLAVOUR: Record<string, string[]> = {
  thermal: ["Reading the heat map", "Cooling down", "Tracing isotherms"],
  mercury: ["Pouring liquid metal", "Polishing chrome", "Settling the surface"],
  glyph: ["Rasterizing glyphs", "Kerning the monospace", "Flushing stdout"],
  starlight: ["Aligning constellations", "Charting the sky", "Catching starlight"],
};

export const VERB_MS = 2500;

/** A fresh order for one turn: the base list plus the look's flavour, shuffled (Fisher-Yates) with `rand` in [0, 1). */
export function verbOrder(design = "", rand: () => number = Math.random): string[] {
  const all = [...VERBS, ...(FLAVOUR[design] ?? [])];
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all;
}

/** The verb to show `elapsedMs` into a turn, changing every VERB_MS and wrapping round. */
export const verbAt = (order: string[], elapsedMs: number): string => order[Math.floor(Math.max(0, elapsedMs) / VERB_MS) % order.length];
