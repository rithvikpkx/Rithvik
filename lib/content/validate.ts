/** Pure validators for the v7 edit window. The client runs them for inline errors; the server actions run
 *  them again (the server is the gate). No server-only imports so node:test can load this. */
import { ICONS } from "../assets/icons.ts"; // explicit .ts: node's strip-types loader needs it

export type Errs = Record<string, string>; // field path ("thesis.1", "links.0.url") → message
export type Checked<T> = { ok: true; value: T } | { ok: false; errors: Errs };

/** True for IANA zone names the runtime knows (Intl throws RangeError otherwise). */
export function isTz(tz: string): boolean {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
/** Only http(s) URLs may sit behind a link; blocks javascript:/data: schemes. */
export function isHttpUrl(u: string): boolean {
  try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; }
}
const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;
export const SLUG = /^[a-z0-9][a-z0-9-]{0,59}$/;
export const ICON_NAMES = Object.keys(ICONS).sort();

/** Collects errors while reading untyped input; each reader returns a safe value even when invalid. */
class Reader {
  errs: Errs = {};
  fail(path: string, msg: string) { this.errs[path] ||= msg; }
  str(v: unknown, path: string, max: number, required = true): string {
    if (typeof v !== "string") { this.fail(path, "Must be text"); return ""; }
    const s = v.trim();
    if (required && !s) this.fail(path, "Required");
    else if (s.length > max) this.fail(path, `Max ${max} characters`);
    return s;
  }
  list<T>(v: unknown, path: string, max: number, item: (x: unknown, p: string) => T, min = 0): T[] {
    if (!Array.isArray(v)) { this.fail(path, "Must be a list"); return []; }
    if (v.length > max) this.fail(path, `Max ${max} items`);
    if (v.length < min) this.fail(path, `Add at least ${min}`);
    return v.slice(0, max).map((x, i) => item(x, `${path}.${i}`));
  }
  obj(v: unknown, path: string): Record<string, unknown> {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return v as Record<string, unknown>;
    this.fail(path, "Invalid"); return {};
  }
  num(v: unknown, path: string, lo: number, hi: number): number {
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) { this.fail(path, `Number from ${lo} to ${hi}`); return 0; }
    return v;
  }
  tz(v: unknown, path: string): string { const s = this.str(v, path, 60); if (s && !isTz(s)) this.fail(path, "Not an IANA timezone (e.g. America/New_York)"); return s; }
  url(v: unknown, path: string): string { const s = this.str(v, path, 300); if (s && !isHttpUrl(s)) this.fail(path, "Must be an http(s) URL"); return s; }
  strs(v: unknown, path: string, max: number, len: number, min = 0) { return this.list(v, path, max, (x, p) => this.str(x, p, len), min); }
  done<T>(value: T): Checked<T> { return Object.keys(this.errs).length ? { ok: false, errors: this.errs } : { ok: true, value }; }
}

export type Profile = { role: string; status: string; line: string; thesis: string[]; about: string[] };
export function checkProfile(v: unknown): Checked<Profile> {
  const r = new Reader(), o = r.obj(v, "_");
  return r.done({ role: r.str(o.role, "role", 80), status: r.str(o.status, "status", 160), line: r.str(o.line, "line", 240),
    thesis: r.strs(o.thesis, "thesis", 6, 60, 1), about: r.strs(o.about, "about", 6, 1200, 1) });
}

export type Now = { city: string; tz: string; building: string; researching: string; learning: string };
export function checkNow(v: unknown): Checked<Now> {
  const r = new Reader(), o = r.obj(v, "_");
  return r.done({ city: r.str(o.city, "city", 60), tz: r.tz(o.tz, "tz"), building: r.str(o.building, "building", 120, false),
    researching: r.str(o.researching, "researching", 120, false), learning: r.str(o.learning, "learning", 120, false) });
}

export type PlaceIn = { key: "home" | "school" | "now"; city: string; tz: string; lat: number; lng: number };
export function checkPlaces(v: unknown): Checked<PlaceIn[]> {
  const r = new Reader();
  return r.done(r.list(v, "places", 6, (x, p) => {
    const o = r.obj(x, p);
    const key = o.key === "home" || o.key === "school" || o.key === "now" ? o.key : (r.fail(`${p}.key`, "home, school or now"), "home");
    return { key, city: r.str(o.city, `${p}.city`, 60), tz: r.tz(o.tz, `${p}.tz`), lat: r.num(o.lat, `${p}.lat`, -90, 90), lng: r.num(o.lng, `${p}.lng`, -180, 180) };
  }, 1));
}

export type StackGroup = { name: string; items: string[] };
export function checkStack(v: unknown): Checked<StackGroup[]> {
  const r = new Reader(), seen = new Set<string>();
  return r.done(r.list(v, "stack", 12, (x, p) => {
    const o = r.obj(x, p), name = r.str(o.name, `${p}.name`, 40);
    if (seen.has(name)) r.fail(`${p}.name`, "Duplicate group");
    seen.add(name);
    return { name, items: r.strs(o.items, `${p}.items`, 30, 40, 1) };
  }, 1));
}

/** Reads a [first, second] string pair. */
const pair = (r: Reader, max: [number, number]) => (x: unknown, p: string): [string, string] => {
  const a = Array.isArray(x) && x.length === 2 ? x : (r.fail(p, "Invalid"), ["", ""]);
  return [r.str(a[0], `${p}.0`, max[0]), r.str(a[1], `${p}.1`, max[1])];
};
export function checkFaq(v: unknown): Checked<[string, string][]> {
  const r = new Reader(); return r.done(r.list(v, "faq", 20, pair(r, [200, 1200]), 1));
}
export function checkNumbers(v: unknown): Checked<[string, string][]> {
  const r = new Reader(); return r.done(r.list(v, "numbers", 8, pair(r, [12, 80]), 1));
}

export type Links = { email: string; github: string; linkedin: string };
export function checkLinks(v: unknown): Checked<Links> {
  const r = new Reader(), o = r.obj(v, "_");
  const email = r.str(o.email, "email", 120);
  if (email && !EMAIL.test(email)) r.fail("email", "Not an email address");
  return r.done({ email, github: r.url(o.github, "github"), linkedin: r.url(o.linkedin, "linkedin") });
}

export type WorkAuth = { workAuth: string };
export function checkWorkAuth(v: unknown): Checked<WorkAuth> {
  const r = new Reader(), o = r.obj(v, "_"); return r.done({ workAuth: r.str(o.workAuth, "workAuth", 80) });
}

export type ProjectIn = { slug: string; title: string; headline: string; kind: string; icon: string; ctx: string; desc: string[]; tags: string[];
  links: { label: string; url: string }[]; published: boolean };
export function checkProject(v: unknown): Checked<ProjectIn> {
  const r = new Reader(), o = r.obj(v, "_"), slug = r.str(o.slug, "slug", 60);
  if (slug && !SLUG.test(slug)) r.fail("slug", "Lowercase letters, digits and dashes");
  const icon = r.str(o.icon, "icon", 40);
  if (icon && !(icon in ICONS)) r.fail("icon", "Pick an icon from the list");
  const seen = new Set<string>();
  const links = r.list(o.links, "links", 6, (x, p) => {
    const l = r.obj(x, p), label = r.str(l.label, `${p}.label`, 30);
    if (seen.has(label)) r.fail(`${p}.label`, "Duplicate label");
    seen.add(label);
    return { label, url: r.url(l.url, `${p}.url`) };
  });
  return r.done({ slug, title: r.str(o.title, "title", 80), headline: r.str(o.headline, "headline", 160), kind: r.str(o.kind, "kind", 40), icon,
    ctx: r.str(o.ctx, "ctx", 160, false), desc: r.strs(o.desc, "desc", 8, 400, 1), tags: r.strs(o.tags, "tags", 12, 30), links, published: o.published === true });
}

export type ExperienceIn = { slug: string; role: string; org: string; when: string; where: string; desc: string[]; tags: string[]; published: boolean };
export function checkExperience(v: unknown): Checked<ExperienceIn> {
  const r = new Reader(), o = r.obj(v, "_"), slug = r.str(o.slug, "slug", 60);
  if (slug && !SLUG.test(slug)) r.fail("slug", "Lowercase letters, digits and dashes");
  return r.done({ slug, role: r.str(o.role, "role", 80), org: r.str(o.org, "org", 80), when: r.str(o.when, "when", 40), where: r.str(o.where, "where", 60, false),
    desc: r.strs(o.desc, "desc", 8, 400, 1), tags: r.strs(o.tags, "tags", 12, 30), published: o.published === true });
}

export type EducationIn = { school: string; degree: string; focus: string; grad: string };
export function checkEducation(v: unknown): Checked<EducationIn> {
  const r = new Reader(), o = r.obj(v, "_");
  return r.done({ school: r.str(o.school, "school", 80), degree: r.str(o.degree, "degree", 120), focus: r.str(o.focus, "focus", 120, false), grad: r.str(o.grad, "grad", 20, false) });
}
