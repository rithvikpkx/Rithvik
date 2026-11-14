/** Owner exclusion: Rithvik's own browsing and chats are never tracked. Pure (no server-only imports, so node:test and
 *  the proxy can load it). Three independent signals: the `rv_owner` device cookie, the `TRACKING_EXCLUDE_IPS`
 *  allow-list, and (client side only) the `rv_owner_seen` mirror cookie that stops the tracker before it loads. */
import { isIP } from "node:net";
import { readCookie } from "./schema.ts";

export const OWNER_COOKIE = "rv_owner";           // HttpOnly: the server's marker, pages cannot read or forge-clear it
export const OWNER_SEEN_COOKIE = "rv_owner_seen"; // readable mirror so the tracker never starts on this device
export const OWNER_MAX_AGE = 2 * 365 * 24 * 3600;

/** The two owner cookies to set (`on`) or clear. Secure only over https so plain-http local dev still works. */
export function ownerCookies(on: boolean, secure: boolean) {
  const base = { path: "/", sameSite: "lax" as const, secure, maxAge: on ? OWNER_MAX_AGE : 0 };
  return [
    { name: OWNER_COOKIE, value: on ? "1" : "", options: { ...base, httpOnly: true } },
    { name: OWNER_SEEN_COOKIE, value: on ? "1" : "", options: { ...base, httpOnly: false } },
  ];
}

/** Constant-time string equality: the loop always walks the longer string, so timing does not reveal how much matched. */
export function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

// BigInt() calls, not literals: the project targets ES2017.
const Z = BigInt(0), N8 = BigInt(8), N16 = BigInt(16), N32 = BigInt(32), FFFF = BigInt(0xffff), MASK32 = BigInt(0xffffffff);

type Addr = { v: 4 | 6; n: bigint };

/** An IP as a number (IPv4-mapped IPv6 becomes IPv4), or null when it does not parse. */
function toAddr(raw: string): Addr | null {
  const ip = raw.trim().replace(/^\[|\]$/g, "").replace(/%.*$/, "").toLowerCase();
  const kind = isIP(ip);
  if (kind === 4) return { v: 4, n: ip.split(".").reduce((n, p) => (n << N8) | BigInt(p), Z) };
  if (kind !== 6) return null;
  const dotted = ip.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  let s = ip;
  if (dotted) {
    const q = dotted[2].split(".").map(Number);
    s = `${dotted[1]}${((q[0] << 8) | q[1]).toString(16)}:${((q[2] << 8) | q[3]).toString(16)}`;
  }
  const halves = s.split("::");
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups = [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  const n = groups.reduce((acc, g) => (acc << N16) | BigInt(parseInt(g, 16)), Z);
  if (n >> N32 === FFFF) return { v: 4, n: n & MASK32 }; // ::ffff:a.b.c.d
  return { v: 6, n };
}

export type Rule = { v: 4 | 6; base: bigint; bits: number };

/** Parses `TRACKING_EXCLUDE_IPS` (comma-separated IPs and CIDRs, IPv4 and IPv6). Bad entries are skipped. */
export function parseExcludeList(list: string | undefined): Rule[] {
  const rules: Rule[] = [];
  for (const item of (list ?? "").split(",")) {
    const [ipPart, bitsPart] = item.trim().split("/");
    const a = ipPart ? toAddr(ipPart) : null;
    if (!a) continue;
    const max = a.v === 4 ? 32 : 128;
    const bits = bitsPart === undefined ? max : /^\d{1,3}$/.test(bitsPart) ? Number(bitsPart) : -1;
    if (bits < 0 || bits > max) continue;
    rules.push({ v: a.v, base: a.n, bits });
  }
  return rules;
}

/** True when the IP falls inside any rule. */
export function ipExcluded(ip: string | null, rules: Rule[]): boolean {
  const a = ip ? toAddr(ip) : null;
  if (!a) return false;
  return rules.some((r) => {
    if (r.v !== a.v) return false;
    const shift = BigInt((r.v === 4 ? 32 : 128) - r.bits);
    return a.n >> shift === r.base >> shift;
  });
}

type HeaderReader = { get(name: string): string | null };

let cachedRaw: string | undefined;
let cachedRules: Rule[] = [];
/** The parsed env list, re-parsed only when the variable changes. */
function envRules(): Rule[] {
  const raw = process.env.TRACKING_EXCLUDE_IPS;
  if (raw !== cachedRaw) { cachedRaw = raw; cachedRules = parseExcludeList(raw); }
  return cachedRules;
}

/** True when these request headers belong to the owner: the `rv_owner` cookie, or a client IP on the exclude list. */
export function isOwnerHeaders(h: HeaderReader): boolean {
  if (readCookie(h.get("cookie"), OWNER_COOKIE) === "1") return true;
  const raw = h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0] || "";
  return ipExcluded(raw, envRules());
}

/** True when this request comes from the owner (device cookie or excluded IP). Tracking and agent logging skip it. */
export function isOwner(req: Request): boolean {
  return LOCAL_DEV || isOwnerHeaders(req.headers);
}

/** The local dev server (next dev) shares the production database, so it never records visits, replays or chats:
 *  development and automated test runs stay out of the dashboard. */
export const LOCAL_DEV = process.env.NODE_ENV === "development";
