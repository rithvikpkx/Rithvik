/** Pure helpers shared by /api/transcribe, /api/speak and the voice hook: no I/O, so they test under plain node. */

export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export const MAX_AUDIO_MS = 25_000;
export const MAX_SPEAK_CHARS = 1200;

export type AudioKind = "webm" | "ogg" | "mp4" | "wav";

/** Identifies an audio container from its first bytes (the content-type header is client-supplied and
 *  proves nothing). Returns null for anything that isn't one of the four formats MediaRecorder emits. */
export function sniffAudio(b: Uint8Array): AudioKind | null {
  const at = (o: number, s: string) => [...s].every((c, i) => b[o + i] === c.charCodeAt(0));
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "webm"; // EBML header
  if (at(0, "OggS")) return "ogg";
  if (at(0, "RIFF") && at(8, "WAVE")) return "wav";
  if (at(4, "ftyp")) return "mp4";
  return null;
}

/** True when a claimed recording length is a sane positive number within the cap (small grace for timer jitter). */
export function durationOk(ms: unknown): boolean {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 && ms <= MAX_AUDIO_MS + 1000;
}

/** Turns a markdown answer into something worth hearing: no code, URLs, footnote markers or syntax characters.
 *  Output is clipped at a sentence boundary when it exceeds `max`. */
export function speakable(md: string, max = MAX_SPEAK_CHARS): string {
  const t = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")       // [label](url) -> label
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/\[\^?\d+\]|【\d+】|[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "") // footnote markers
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, "")
    .replace(/[*_~#|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > max / 2 ? cut.slice(0, end + 1) : cut;
}
