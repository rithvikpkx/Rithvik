/** Prompt history for the agent: newest first, deduped, capped, persisted in localStorage. */

export const HISTORY_MAX = 50;
export const HISTORY_KEY = "rithvik-agent-history";

/** Puts `q` at the front, dropping any earlier copy, and trims to HISTORY_MAX. */
export function pushHistory(list: string[], q: string, max = HISTORY_MAX): string[] {
  const t = q.trim();
  return t ? [t, ...list.filter((x) => x !== t)].slice(0, max) : list;
}

/** ↑/↓ over the ring. `idx` is -1 when not browsing; dir 1 goes older, -1 newer.
 *  Returns the new index and the text to show ("" when back at the live line). */
export function stepHistory(list: string[], idx: number, dir: 1 | -1): { idx: number; value: string } {
  if (!list.length) return { idx: -1, value: "" };
  const next = Math.max(-1, Math.min(list.length - 1, idx + dir));
  return { idx: next, value: next < 0 ? "" : list[next] };
}

/** Reads the saved ring; storage can be missing or blocked, and the value can be junk. */
export function loadHistory(storage: Pick<Storage, "getItem"> | undefined): string[] {
  try {
    const v: unknown = JSON.parse(storage?.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

/** Writes the ring; failure (private mode, quota) just means no persistence. */
export function saveHistory(storage: Pick<Storage, "setItem"> | undefined, list: string[]): void {
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {}
}
