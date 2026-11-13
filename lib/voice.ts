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

/** Removes an echoed bias prompt from a transcript. On silence or noise the model parrots the prompt
 *  back as if it were speech, which would otherwise land in the visitor's input box. */
export function stripPromptEcho(text: string, prompt: string): string {
  const i = text.toLowerCase().indexOf(prompt.toLowerCase());
  return (i < 0 ? text : text.slice(0, i) + text.slice(i + prompt.length)).replace(/^[\s.,]+|[\s,]+$/g, "");
}

/** The voices a visitor can pick. One pick drives both voice mode and read-aloud replies, so the agent always
 *  sounds the same; every id here is checked to work in both. Best first. */
export const VOICES = [
  { id: "marin", note: "natural, warm" }, { id: "cedar", note: "natural, grounded" }, { id: "coral", note: "bright, friendly" },
  { id: "sage", note: "calm, gentle" }, { id: "ballad", note: "soft storyteller" }, { id: "verse", note: "expressive" },
  { id: "ash", note: "low, steady" }, { id: "shimmer", note: "light, airy" },
] as const;
/** Delivery styles, sent as speaking instructions; the client only ever names one by id. All aim at sounding like a
 *  person talking, never someone reading a script. */
export const STYLES = {
  natural: "Talk like a friendly person in a relaxed conversation: natural rhythm, light emphasis on what matters, small pauses between thoughts, warm and easy. Never sound like you are reading a script.",
  upbeat: "Talk with bright, genuine energy, like a friend excited to share good news: lively rhythm, smiling tone, still natural and conversational.",
  calm: "Talk in a calm, unhurried, reassuring way, like a thoughtful friend: soft emphasis, gentle pauses, never flat or robotic.",
} as const;
export type StyleId = keyof typeof STYLES;
export const RATE_MIN = 0.75, RATE_MAX = 1.75;
/** The picker's "1x" plays at this real rate: the voices read a touch slow, so 1x is 10% brisker. */
export const BASE_RATE = 1.1;

/** An allow-listed voice id (anything else falls back to the default). */
export const pickVoice = (v: unknown): string => (VOICES.some((x) => x.id === v) ? (v as string) : "marin");
/** An allow-listed style id (anything else falls back to natural). */
/** The pace to ask for in words (voice mode has no speed control, so the same slider becomes an instruction). */
export const paceOf = (rate: number): string => (rate < 0.95 ? "a relaxed, unhurried pace" : rate < 1.15 ? "a natural, brisk conversational pace" : rate < 1.4 ? "a quick, energetic pace" : "a fast pace");
export const pickStyle = (s: unknown): StyleId => (typeof s === "string" && Object.hasOwn(STYLES, s) ? (s as StyleId) : "natural");
/** A playback rate inside the supported band (non-numbers become 1). */
export const clampRate = (r: unknown): number => (typeof r === "number" && Number.isFinite(r) ? Math.min(RATE_MAX, Math.max(RATE_MIN, r)) : 1);
