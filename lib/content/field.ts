/** Inline-edit field keys: parsing and applying ONE changed text field to the current content. Pure (no server-only
 *  imports) so node:test loads it; app/admin/content-actions.ts `saveField` does the auth and the writes.
 *
 *  Key grammar (also the `data-edit="…"` values the designs render):
 *    v7.role | v7.status | v7.line            profile text
 *    v7.thesis.<i> | v7.about.<i>             profile list item
 *    v7.now.city|building|researching|learning
 *    faq.<i>.q|a   numbers.<i>.v|l            pair list item
 *    name.first | name.last
 *    project:<slug>:title|headline|kind|ctx|desc.<i>
 *    role:<slug>:role|org|when|where|desc.<i>
 *    edu:school|degree|focus|grad */
import type { Content } from "./types";
import {
  checkProfile, checkNow, checkFaq, checkNumbers, checkProject, checkExperience, checkEducation,
  type Errs, type Profile, type Now, type ProjectIn, type ExperienceIn, type EducationIn,
} from "./validate.ts"; // explicit .ts: node's strip-types loader needs it

export type FieldTarget =
  | { kind: "profile"; field: "role" | "status" | "line" }
  | { kind: "list"; field: "thesis" | "about"; i: number }
  | { kind: "now"; field: "city" | "building" | "researching" | "learning" }
  | { kind: "pair"; list: "faq" | "numbers"; i: number; j: 0 | 1 }
  | { kind: "name"; part: "first" | "last" }
  | { kind: "project"; slug: string; field: "title" | "headline" | "kind" | "ctx" | "desc"; i: number }
  | { kind: "role"; slug: string; field: "role" | "org" | "when" | "where" | "desc"; i: number }
  | { kind: "edu"; field: "school" | "degree" | "focus" | "grad" };

const SLUG = "[a-z0-9][a-z0-9-]{0,59}";
const IDX = "(0|[1-9]\\d{0,2})"; // no leading zeros, at most 999

/** `desc` needs an index; the other fields must not have one. */
const descOk = (field: string, idx?: string) => (field === "desc") === (idx !== undefined);

/** Parses a `data-edit` key; null for anything that is not in the grammar above (the server never guesses). */
export function parseFieldKey(key: unknown): FieldTarget | null {
  if (typeof key !== "string" || key.length > 120) return null;
  let m: RegExpMatchArray | null;
  if ((m = key.match(/^v7\.(role|status|line)$/))) return { kind: "profile", field: m[1] as "role" };
  if ((m = key.match(new RegExp(`^v7\\.(thesis|about)\\.${IDX}$`)))) return { kind: "list", field: m[1] as "thesis", i: +m[2] };
  if ((m = key.match(/^v7\.now\.(city|building|researching|learning)$/))) return { kind: "now", field: m[1] as "city" };
  if ((m = key.match(new RegExp(`^faq\\.${IDX}\\.(q|a)$`)))) return { kind: "pair", list: "faq", i: +m[1], j: m[2] === "q" ? 0 : 1 };
  if ((m = key.match(new RegExp(`^numbers\\.${IDX}\\.(v|l)$`)))) return { kind: "pair", list: "numbers", i: +m[1], j: m[2] === "v" ? 0 : 1 };
  if ((m = key.match(/^name\.(first|last)$/))) return { kind: "name", part: m[1] as "first" };
  if ((m = key.match(new RegExp(`^project:(${SLUG}):(title|headline|kind|ctx|desc)(?:\\.${IDX})?$`)))) {
    return descOk(m[2], m[3]) ? { kind: "project", slug: m[1], field: m[2] as "title", i: +(m[3] ?? 0) } : null;
  }
  if ((m = key.match(new RegExp(`^role:(${SLUG}):(role|org|when|where|desc)(?:\\.${IDX})?$`)))) {
    return descOk(m[2], m[3]) ? { kind: "role", slug: m[1], field: m[2] as "role", i: +(m[3] ?? 0) } : null;
  }
  if ((m = key.match(/^edu:(school|degree|focus|grad)$/))) return { kind: "edu", field: m[1] as "school" };
  return null;
}

/** What `saveField` reads: the same shape `loadEditData` returns (drafts included). */
export type FieldSource = {
  content: Pick<Content, "role" | "status" | "line" | "thesis" | "about" | "now" | "faq" | "numbers">;
  projects: (ProjectIn & { id: string })[];
  experience: (ExperienceIn & { id: string })[];
  education: { id: string | null } & EducationIn;
};

/** The one write a field change turns into, already validated by the same checkers the Edit content window uses. */
export type FieldOp =
  | { op: "section"; section: "profile"; input: Profile }
  | { op: "section"; section: "now"; input: Now }
  | { op: "section"; section: "faq" | "numbers"; input: [string, string][] }
  | { op: "name"; key: "hero.name.line1" | "hero.name.line2"; value: string }
  | { op: "project"; id: string; input: ProjectIn }
  | { op: "role"; id: string; input: ExperienceIn }
  | { op: "edu"; id: string | null; input: EducationIn };
export type Applied = ({ ok: true } & FieldOp) | { ok: false; error: string };

const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });
const GONE = "That item no longer exists. Reload the page.";
/** The first message of a validator's error map, which is what an inline toast can show. */
const firstErr = (e: Errs) => Object.values(e)[0] ?? "Invalid value";
/** Copy of `arr` with item `i` replaced, or null when `i` is out of range (a stale key never appends). */
const put = <T>(arr: readonly T[], i: number, v: T): T[] | null => (i < arr.length ? arr.map((x, k) => (k === i ? v : x)) : null);

/** Applies one text change to the current content and validates the whole record it lives in. Never throws. */
export function applyField(src: FieldSource, t: FieldTarget, raw: unknown): Applied {
  if (typeof raw !== "string") return bad("Must be text");
  const value = raw.replace(/\s*\n\s*/g, " ").trim(); // inline fields are single-line
  const c = src.content;
  switch (t.kind) {
    case "profile": case "list": {
      const base: Profile = { role: c.role, status: c.status, line: c.line, thesis: c.thesis, about: c.about };
      let next: Profile | null;
      if (t.kind === "profile") next = { ...base, [t.field]: value };
      else { const l = put(base[t.field], t.i, value); next = l && { ...base, [t.field]: l }; }
      if (!next) return bad(GONE);
      const r = checkProfile(next);
      return r.ok ? { ok: true, op: "section", section: "profile", input: r.value } : bad(firstErr(r.errors));
    }
    case "now": {
      const r = checkNow({ ...c.now, [t.field]: value });
      return r.ok ? { ok: true, op: "section", section: "now", input: r.value } : bad(firstErr(r.errors));
    }
    case "pair": {
      const list = c[t.list];
      const cur = list[t.i];
      if (!cur) return bad(GONE);
      const pair: [string, string] = t.j === 0 ? [value, cur[1]] : [cur[0], value];
      const r = (t.list === "faq" ? checkFaq : checkNumbers)(list.map((x, k) => (k === t.i ? pair : x)));
      return r.ok ? { ok: true, op: "section", section: t.list, input: r.value } : bad(firstErr(r.errors));
    }
    case "name":
      if (!value) return bad("Required");
      if (value.length > 40) return bad("Max 40 characters");
      return { ok: true, op: "name", key: t.part === "first" ? "hero.name.line1" : "hero.name.line2", value };
    case "project": {
      const p = src.projects.find((x) => x.slug === t.slug);
      if (!p) return bad(GONE);
      const desc = t.field === "desc" ? put(p.desc, t.i, value) : p.desc;
      if (!desc) return bad(GONE);
      const r = checkProject({ ...p, desc, ...(t.field === "desc" ? {} : { [t.field]: value }) });
      return r.ok ? { ok: true, op: "project", id: p.id, input: r.value } : bad(firstErr(r.errors));
    }
    case "role": {
      const p = src.experience.find((x) => x.slug === t.slug);
      if (!p) return bad(GONE);
      const desc = t.field === "desc" ? put(p.desc, t.i, value) : p.desc;
      if (!desc) return bad(GONE);
      const r = checkExperience({ ...p, desc, ...(t.field === "desc" ? {} : { [t.field]: value }) });
      return r.ok ? { ok: true, op: "role", id: p.id, input: r.value } : bad(firstErr(r.errors));
    }
    case "edu": {
      const e = src.education;
      const r = checkEducation({ school: e.school, degree: e.degree, focus: e.focus, grad: e.grad, [t.field]: value });
      return r.ok ? { ok: true, op: "edu", id: e.id, input: r.value } : bad(firstErr(r.errors));
    }
  }
}
