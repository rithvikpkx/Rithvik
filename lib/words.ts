const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];

/** Sentence-initial count word ("Six"), digits past twelve, so copy like "Six projects" never goes stale. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
