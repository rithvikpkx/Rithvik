/** Pure helpers for first-party tracking (no server-only imports, so node:test can load them):
 *  cookie and IP reading, bot detection, UA parsing, and validation of everything the browser sends. */
import { isIP } from "node:net";

export const RV_COOKIE = "rv_id";
export const COOKIE_MAX_AGE = 365 * 24 * 3600;
export const MAX_BATCH_BYTES = 64 * 1024;
export const MAX_BATCH_EVENTS = 100;
export const MAX_EVENT_JSON = 2000;
export const MAX_REPLAY_CHUNK = 512 * 1024;
export const MAX_REPLAY_TOTAL = 8 * 1024 * 1024;
export const MAX_REPLAY_SEQ = 999;

export const EVENT_TYPES = [
  "pageview", "design", "section", "click", "outbound", "scroll", "active", "overlay", "resume",
  "agent_open", "agent_turn", "composer_open", "composer_send", "error", "perf", "identify",
  "read", "hover", "copy",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
const TYPE_SET = new Set<string>(EVENT_TYPES);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical UUID string. */
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

/** Trims and caps a string; empty or non-string input becomes null. */
export function clip(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t.slice(0, max) : null;
}

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** The visitor id from a Cookie header, or null when absent or not a UUID. */
export function visitorIdFromCookie(header: string | null | undefined): string | null {
  const v = readCookie(header, RV_COOKIE);
  return isUuid(v) ? v.toLowerCase() : null;
}

type HeaderReader = { get(name: string): string | null };

/** The raw client IP: Vercel's `x-real-ip`, else the first `x-forwarded-for` hop. Null unless it parses as an IP. */
export function pickIp(h: HeaderReader): string | null {
  const raw = (h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "").trim().replace(/^\[|\](:\d+)?$/g, "").replace(/%.*$/, "");
  return isIP(raw) ? raw : null;
}

/** False for loopback, private, link-local, CGNAT and unique-local addresses (nothing to look up). */
export function isPublicIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return !(a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) || a >= 224);
  }
  const l = ip.toLowerCase();
  if (l.startsWith("::ffff:") && isIP(l.slice(7)) === 4) return isPublicIp(l.slice(7));
  return !(l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80"));
}

const BOT_UA = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|lighthouse|pagespeed|gtmetrix|curl\/|wget|python-requests|python-urllib|aiohttp|httpx|go-http-client|java\/|okhttp|libwww|scrapy|node-fetch|undici|axios|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|statuscake|vercel-screenshot|chrome-lighthouse|bytespider|gptbot|claudebot|perplexity/i;

/** True for an obvious bot: a known crawler/tool UA, an empty UA, or the browser's own automation flag. */
export function isBotSignal(ua: string | null, webdriver: boolean): boolean {
  return webdriver || !ua || ua.length < 20 || BOT_UA.test(ua);
}

/** Coarse browser / OS / device from a UA string (shortcut: regex order, not a full UA database; upgrade if the admin view needs more). */
export function parseUa(ua: string | null): { browser: string | null; os: string | null; device: string | null } {
  if (!ua) return { browser: null, os: null, device: null };
  const m = (re: RegExp) => ua.match(re)?.[1];
  const browser =
    (m(/Edg(?:e|A|iOS)?\/(\d+)/) && `Edge ${m(/Edg(?:e|A|iOS)?\/(\d+)/)}`) ||
    (m(/OPR\/(\d+)/) && `Opera ${m(/OPR\/(\d+)/)}`) ||
    (m(/(?:Chrome|CriOS)\/(\d+)/) && `Chrome ${m(/(?:Chrome|CriOS)\/(\d+)/)}`) ||
    (m(/(?:Firefox|FxiOS)\/(\d+)/) && `Firefox ${m(/(?:Firefox|FxiOS)\/(\d+)/)}`) ||
    (/Safari\//.test(ua) && m(/Version\/(\d+)/) ? `Safari ${m(/Version\/(\d+)/)}` : null);
  const os = /Windows/.test(ua) ? "Windows" : /(iPhone|iPad|iPod)/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android"
    : /Mac OS X/.test(ua) ? "macOS" : /CrOS/.test(ua) ? "ChromeOS" : /Linux/.test(ua) ? "Linux" : null;
  const device = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) ? "tablet" : /Mobi|iPhone|Android/.test(ua) ? "mobile" : "desktop";
  return { browser: browser || null, os, device };
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

/** Keeps only the five UTM keys, clipped; null when none are present. */
export function cleanUtm(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object") return null;
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const s = clip((v as Record<string, unknown>)[k], 100);
    if (s) out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/** Copies JSON-safe values with strings clipped, arrays and objects bounded, depth limited. */
function cleanValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.slice(0, 500);
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v === null) return v;
  if (depth >= 3) return null;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => cleanValue(x, depth + 1));
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v).slice(0, 20)) out[k.slice(0, 40)] = cleanValue(x, depth + 1);
    return out;
  }
  return null;
}

export type Ctx = {
  entry: string | null; referrer: string | null; utm: Record<string, string> | null; design: string | null;
  viewport: string | null; screen: string | null; tz: string | null; lang: string | null; languages: string | null; webdriver: boolean;
};
export type CleanEvent = { type: EventType; at: number; data: Record<string, unknown> };
export type Batch = { visitId: string; ctx: Ctx; events: CleanEvent[] };

/** Clamps a client timestamp (ms) to [now - 1 day, now + 1 minute]; anything else becomes `now`. */
export function clampAt(at: unknown, now: number): number {
  return typeof at === "number" && Number.isFinite(at) && at > now - 86_400_000 && at < now + 60_000 ? Math.round(at) : now;
}

/** Validates a collection POST body: shape, event types, sizes. Unknown types and oversized events are dropped
 *  (an old client never fails the whole batch); a body with no valid visit id or no usable event is rejected. */
export function validateBatch(body: unknown, now = Date.now()): { ok: true; batch: Batch } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "bad body" };
  const b = body as Record<string, unknown>;
  if (!isUuid(b.vid)) return { ok: false, error: "bad visit id" };
  if (!Array.isArray(b.e) || b.e.length === 0) return { ok: false, error: "no events" };
  if (b.e.length > MAX_BATCH_EVENTS) return { ok: false, error: "too many events" };
  const events: CleanEvent[] = [];
  for (const raw of b.e) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (typeof e.t !== "string" || !TYPE_SET.has(e.t)) continue;
    const data = e.d && typeof e.d === "object" && !Array.isArray(e.d) ? (cleanValue(e.d) as Record<string, unknown>) : {};
    if (JSON.stringify(data).length > MAX_EVENT_JSON) continue;
    events.push({ type: e.t as EventType, at: clampAt(e.at, now), data });
  }
  if (events.length === 0) return { ok: false, error: "no valid events" };
  const c = (b.ctx && typeof b.ctx === "object" ? b.ctx : {}) as Record<string, unknown>;
  const ctx: Ctx = {
    entry: clip(c.entry, 300), referrer: clip(c.referrer, 300), utm: cleanUtm(c.utm), design: clip(c.design, 40),
    viewport: clip(c.viewport, 20), screen: clip(c.screen, 20), tz: clip(c.tz, 60), lang: clip(c.lang, 20),
    languages: clip(c.languages, 100), webdriver: c.webdriver === true,
  };
  return { ok: true, batch: { visitId: b.vid.toLowerCase(), ctx, events } };
}

/** True when the buffer starts with the gzip magic bytes (the replay route stores chunks as sent, so check what it stores). */
export function isGzip(buf: Uint8Array): boolean {
  return buf.length > 18 && buf[0] === 0x1f && buf[1] === 0x8b;
}

/** A valid replay chunk sequence number, or null. */
export function parseSeq(v: unknown): number | null {
  const n = typeof v === "string" && /^\d{1,3}$/.test(v) ? Number(v) : null;
  return n !== null && n <= MAX_REPLAY_SEQ ? n : null;
}

/** An email address in a sane shape (lowercased), or null. */
export function cleanEmail(v: unknown): string | null {
  const s = clip(v, 254)?.toLowerCase();
  return s && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(s) ? s : null;
}
