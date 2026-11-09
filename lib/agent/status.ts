/** Spinner, rotating verbs and the status-line text. Pure and time-driven: callers pass elapsed
 *  milliseconds, so there is no counter to drift and nothing to mock in tests. */
import { SPINNERS } from "../assets/misc.ts";

export const SPIN_FRAMES: string[] = SPINNERS.dots.frames;
export const SPIN_INTERVAL = SPINNERS.dots.interval;
export const VERBS = ["Retrieving", "Reading", "Grounding", "Drafting", "Verifying"];
const VERB_MS = 1200;

/** Braille frame for `elapsedMs` since the turn began. */
export function spinFrame(elapsedMs: number): string {
  return SPIN_FRAMES[Math.floor(elapsedMs / SPIN_INTERVAL) % SPIN_FRAMES.length];
}

/** Verb that rotates every ~1.2s. */
export function verbAt(elapsedMs: number): string {
  return VERBS[Math.floor(elapsedMs / VERB_MS) % VERBS.length];
}

/** "42s" under a minute, otherwise whole minutes rounded up ("3m"). */
export function formatRetry(secs: number): string {
  const s = Math.max(1, Math.ceil(secs));
  return s < 60 ? `${s}s` : `${Math.ceil(s / 60)}m`;
}

/** What the panel knows about spend and speed. Every field is optional: nothing is shown until it is known. */
export type Usage = {
  /** The visitor key's hourly window, from the X-RateLimit-* headers. `reset` is epoch seconds. */
  limit?: number; remaining?: number; reset?: number;
  /** Answer-model tokens this conversation, and for the last turn. */
  tokens: number; lastTokens?: number;
  /** Last turn: first byte of the stream, and until the answer finished. */
  ttfbMs?: number; totalMs?: number;
  /** CDN cache header when the host sent one. */
  cache?: string;
};

/** "980" under a thousand, else "1.2k" / "12.4k" / "123k". */
export function formatTokens(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
}

/** Elapsed milliseconds as seconds with one decimal ("1.9s"). */
export const formatSecs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/** The detail rows for /usage as [label, value] pairs; rows whose facts are unknown are left out. */
export function usageLines(u: Usage, model: string | undefined, nowMs: number): [string, string][] {
  const rows: [string, string][] = [];
  if (u.limit !== undefined && u.remaining !== undefined) {
    const when = u.reset && u.reset * 1000 > nowMs
      ? ` · resets ${new Date(u.reset * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} (in ${formatRetry((u.reset * 1000 - nowMs) / 1000)})`
      : "";
    rows.push(["Rate limit", `${u.limit - u.remaining}/${u.limit} used this hour · ${u.remaining} left${when}`]);
  }
  rows.push(["Tokens", u.tokens ? `${u.tokens.toLocaleString("en-US")} this session${u.lastTokens ? ` · ${u.lastTokens.toLocaleString("en-US")} last turn` : ""}` : "none yet this session"]);
  const speed = [u.ttfbMs !== undefined && `first byte ${formatSecs(u.ttfbMs)}`, u.totalMs !== undefined && `total ${formatSecs(u.totalMs)}`].filter(Boolean);
  if (speed.length) rows.push(["Last turn", speed.join(" · ")]);
  if (model) rows.push(["Model", model]);
  if (u.cache) rows.push(["Cache", u.cache]);
  return rows;
}

export type StatusState =
  | { kind: "idle"; turns: number; usage?: Usage }
  | { kind: "busy"; elapsedMs: number }
  | { kind: "limited"; status: 429 | 503; retrySecs: number };

/** `cls` lets the stylesheet drop the least important pieces first on a narrow panel. */
export type StatusSeg = { text: string; tone?: "spin" | "warn"; cls?: string };

/** The status line as ordered segments (rendered separated by gaps). */
export function statusSegments(s: StatusState): StatusSeg[] {
  if (s.kind === "busy") {
    return [
      { text: spinFrame(s.elapsedMs), tone: "spin" },
      { text: `${verbAt(s.elapsedMs)}…` },
      { text: `${(s.elapsedMs / 1000).toFixed(1)}s` },
      { text: "esc to interrupt" },
    ];
  }
  if (s.kind === "limited") {
    const what = s.status === 429 ? "rate limited" : "unavailable";
    return [{ text: `⚠ ${what} · retry in ${formatRetry(s.retrySecs)}`, tone: "warn" }, { text: "? for shortcuts" }];
  }
  // ● ready · 3 turns · 41/60 left · 12.4k tok · 1.9s · ? for shortcuts  (unknown pieces are left out)
  const u = s.usage;
  const segs: StatusSeg[] = [{ text: "● ready" }, { text: `${s.turns} turn${s.turns === 1 ? "" : "s"}` }];
  if (u?.limit !== undefined && u.remaining !== undefined) segs.push({ text: `${u.remaining}/${u.limit} left`, cls: "s-left", ...(u.remaining <= 5 ? { tone: "warn" as const } : {}) });
  if (u?.tokens) segs.push({ text: `${formatTokens(u.tokens)} tok`, cls: "s-tok" });
  if (u?.totalMs !== undefined) segs.push({ text: formatSecs(u.totalMs), cls: "s-time" });
  segs.push({ text: "? for shortcuts", cls: "s-hint" });
  return segs;
}
