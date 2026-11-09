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

export type StatusState =
  | { kind: "idle"; turns: number }
  | { kind: "busy"; elapsedMs: number }
  | { kind: "limited"; status: 429 | 503; retrySecs: number };

export type StatusSeg = { text: string; tone?: "spin" | "warn" };

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
  return [{ text: "● ready" }, { text: `${s.turns} turn${s.turns === 1 ? "" : "s"}` }, { text: "? for shortcuts" }];
}
