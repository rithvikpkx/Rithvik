/** Formatting for the status page. Pure and locale-independent (fixed en-US, UTC) so the server render and the
 *  browser agree and nothing flashes or mismatches on hydration. */
import type { Check } from "./types.ts";
import { toMs } from "../charts/scale.ts";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const p2 = (n: number) => String(n).padStart(2, "0");
const DASH = "–";

/** "1,284"; a dash for null. */
export const fmtInt = (n: number | null | undefined): string => (typeof n === "number" && Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : DASH);

/** Uptime as a percentage, truncated (never rounded up: 99.996% must not read as 100%). */
export function fmtUptime(p: number | null | undefined): string {
  if (typeof p !== "number" || !Number.isFinite(p)) return DASH;
  const t = Math.floor(Math.min(100, Math.max(0, p)) * 100) / 100;
  return `${Number.isInteger(t) ? t : t.toFixed(2).replace(/0$/, "")}%`;
}

/** A 0-1 ratio as a percentage with one decimal under 10%, else whole. */
export function fmtRate(r: number | null | undefined): string {
  if (typeof r !== "number" || !Number.isFinite(r)) return DASH;
  const p = r * 100;
  return p === 0 ? "0%" : p < 0.1 ? "<0.1%" : `${p < 10 ? p.toFixed(1).replace(/\.0$/, "") : Math.round(p)}%`;
}

/** 420 → "420 ms", 1830 → "1.8 s". */
export function fmtMs(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return DASH;
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

/** "~$0.42"; "<$0.01" for fractions of a cent; a dash when unknown. */
export function fmtUsd(n: number | null | undefined): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return DASH;
  return n > 0 && n < 0.01 ? "<$0.01" : `~$${n.toFixed(2)}`;
}

/** "14:05" in UTC. */
export function fmtClock(t: number | string): string {
  const d = new Date(toMs(t));
  return Number.isNaN(d.getTime()) ? "" : `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

/** "Nov 9, 14:05 UTC". */
export function fmtStamp(t: number | string): string {
  const d = new Date(toMs(t));
  return Number.isNaN(d.getTime()) ? "" : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${fmtClock(t)} UTC`;
}

/** Axis label for a bucket: "14:00" across a day, "Mon 06:00" across a week. */
export function bucketLabel(t: number | string, range: "24h" | "7d"): string {
  const d = new Date(toMs(t));
  if (Number.isNaN(d.getTime())) return "";
  return range === "24h" ? fmtClock(t) : `${DOW[d.getUTCDay()]} ${fmtClock(t)}`;
}

/** The headline state from the newest checks: no data, failing now, or operational. */
export function healthState(recent: Check[]): { tone: "none" | "bad" | "good"; text: string } {
  if (!recent.length) return { tone: "none", text: "Waiting for the first health check" };
  if (!recent[recent.length - 1].ok) return { tone: "bad", text: "Experiencing issues" };
  return { tone: "good", text: "All systems operational" };
}
