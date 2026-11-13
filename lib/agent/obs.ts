/** Pure helpers for agent observability and sharing (no server-only imports, so node:test can load them). */
import { createHash, randomBytes } from "node:crypto";

export const SHARE_TTL_DAYS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export type HeaderReader = { get(name: string): string | null };
export type Geo = { country: string | null; region: string | null; city: string | null };

/** True for a canonical UUID string; session ids from the client must pass this before any query. */
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

/** True for a share token in the shape newShareToken produces (22 URL-safe chars). */
export function isShareToken(s: unknown): s is string {
  return typeof s === "string" && TOKEN_RE.test(s);
}

/** Trims and caps a string; empty or non-string input becomes null. */
export function clip(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t ? t.slice(0, max) : null;
}

/** Non-negative integer or null, for the telemetry columns (a NaN or float would fail the insert). */
export function safeInt(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 2_000_000_000) : null;
}

/** Coarse location from Vercel's geo headers (city is percent-encoded there). */
export function geoFromHeaders(h: HeaderReader): Geo {
  const read = (name: string) => {
    const v = h.get(name);
    if (!v) return null;
    try { return clip(decodeURIComponent(v), 80); } catch { return clip(v, 80); }
  };
  return { country: read("x-vercel-ip-country"), region: read("x-vercel-ip-country-region"), city: read("x-vercel-ip-city") };
}

/** sha256(salt:ip) as hex, or null when there is no salt: an unsalted hash of an IPv4 is reversible, so store nothing. */
export function hashIp(ip: string, salt: string | undefined): string | null {
  if (!salt || !ip) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** 22-char URL-safe token from 128 random bits. */
export function newShareToken(): string {
  return randomBytes(16).toString("base64url");
}

/** ISO expiry `SHARE_TTL_DAYS` after `now`. */
export function shareExpiry(now = Date.now()): string {
  return new Date(now + SHARE_TTL_DAYS * 86_400_000).toISOString();
}

/** True while a share link's expiry is in the future. */
export function isShareLive(expiresAt: string | null, now = Date.now()): boolean {
  return !!expiresAt && Date.parse(expiresAt) > now;
}

const EMAIL_RE = /[^\s@<>()"',;:]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]+/g;
const PHONE_RE = /(?<![\w.])\+?\d[\d\s().-]{6,}\d(?![\w])/g;

/** Replaces emails and phone-like numbers for the public share view. A run of 9+ digits counts as a phone
 *  (shortcut: 7-8 digit local numbers pass through, upgrade if shared chats ever need stricter masking). */
export function redactPII(text: string): string {
  return text
    .replace(EMAIL_RE, "[email removed]")
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, "").length >= 9 ? "[phone removed]" : m));
}

export type TurnRow = {
  role: "user" | "assistant" | "tool";
  content: string;
  tools?: unknown;
  sources?: unknown;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  ttfbMs?: number;
  totalMs?: number;
  status?: number;
  error?: string;
  cached?: boolean;
};

/** Maps a turn to an `agent_messages` insert, clamping every field to what the column can hold. */
export function toMessageRow(sessionId: string, t: TurnRow) {
  return {
    session_id: sessionId,
    role: t.role,
    content: (t.content ?? "").slice(0, 20_000),
    tools: t.tools ?? null,
    sources: t.sources ?? null,
    model: clip(t.model, 80),
    tokens_in: safeInt(t.tokensIn),
    tokens_out: safeInt(t.tokensOut),
    ttfb_ms: safeInt(t.ttfbMs),
    total_ms: safeInt(t.totalMs),
    status: safeInt(t.status),
    error: clip(t.error, 500),
    cached: t.cached === true,
  };
}
