/** In-chat artifacts: the model may only hand over DATA (a strict JSON spec); our own SVG components draw it.
 *  parseArtifact is the single gate, used by the server (tool call) and again by the client (frame), and it
 *  rebuilds every field from scratch: unknown keys are dropped, strings lose control characters, markup characters and
 *  URLs, numbers must be finite, and every collection is capped. Nothing here can carry markup or a link.
 *  Pure (no "@/" imports) so node:test can load it. */
import { yearValue } from "../charts/scale.ts";

export const ARTIFACT_TYPES = ["bar", "line", "area", "donut", "timeline", "table", "stats", "graph"] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

/** Limits (also stated in the tool description). */
export const MAX_POINTS = 24;
export const MAX_SERIES = 8;
export const MAX_ROWS = 12;
export const MAX_COLS = 6;
export const MAX_TEXT = 80;
const MAX_SLICES = 8; // the categorical palette has eight validated hues
const MAX_STATS = 8;
const MAX_EDGES = 48;

/** One member per form (distributive), so `spec.type` narrows cleanly. */
type Cartesian<T extends "bar" | "line" | "area"> = T extends unknown ? { type: T; title: string; unit?: string; data: { labels: string[]; series: { name: string; values: number[] }[] } } : never;

export type ArtifactSpec =
  | Cartesian<"bar" | "line" | "area">
  | { type: "donut"; title: string; unit?: string; data: { slices: { label: string; value: number }[] } }
  | { type: "timeline"; title: string; data: { items: { label: string; start: string; end?: string; note?: string }[] } }
  | { type: "table"; title: string; data: { columns: string[]; rows: string[][] } }
  | { type: "stats"; title: string; data: { items: { label: string; value: string; note?: string }[] } }
  | { type: "graph"; title: string; data: { nodes: { id: string; label: string; group?: string }[]; edges: { from: string; to: string }[] } };

export type ParsedArtifact = { ok: true; spec: ArtifactSpec } | { ok: false; error: string };

/** Plain one-line text: strings and numbers only; control characters, < > and URLs removed; capped at `max`. */
export function clean(v: unknown, max = MAX_TEXT): string {
  const s = typeof v === "number" && Number.isFinite(v) ? String(v) : typeof v === "string" ? v : "";
  return s
    .replace(/[\u0000-\u001f\u007f<>`]/g, " ")
    .replace(/\b(?:https?|javascript|data|ftp|file|mailto):\S+/gi, "")
    .replace(/\bwww\.\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fail = (error: string): ParsedArtifact => ({ ok: false, error });

/** Validates and rebuilds an artifact from untrusted input (an object, or a JSON string of one). */
export function parseArtifact(input: unknown, now = new Date()): ParsedArtifact {
  let raw = input;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { return fail("Arguments must be a JSON object."); } }
  if (!isObj(raw)) return fail("Arguments must be an object with type, title and data.");
  const type = typeof raw.type === "string" ? (raw.type.trim().toLowerCase() as ArtifactType) : undefined;
  if (!type || !ARTIFACT_TYPES.includes(type)) return fail(`type must be one of: ${ARTIFACT_TYPES.join(", ")}.`);
  const title = clean(raw.title);
  if (!title) return fail("title is required (a few words).");
  let data = raw.data;
  if (typeof data === "string") { try { data = JSON.parse(data); } catch { return fail("data must be a JSON object."); } }
  if (!isObj(data)) return fail("data must be an object.");
  const unit = clean(raw.unit, 12) || undefined;

  switch (type) {
    case "bar":
    case "line":
    case "area": {
      const labels = arr(data.labels).slice(0, MAX_POINTS).map((l) => clean(l, 40));
      if (labels.length < (type === "bar" ? 1 : 2) || labels.some((l) => !l)) return fail(`data.labels needs ${type === "bar" ? "1" : "2"}-${MAX_POINTS} non-empty strings.`);
      const series = arr(data.series).slice(0, MAX_SERIES).flatMap((s) => {
        if (!isObj(s)) return [];
        const name = clean(s.name, 40);
        const vals = arr(s.values).slice(0, labels.length).map(num);
        // a series must have exactly one finite number per label, else it is dropped
        return name && vals.length === labels.length && vals.every((v) => v !== null) ? [{ name, values: vals as number[] }] : [];
      });
      if (!series.length) return fail("data.series needs at least one {name, values} with one finite number per label.");
      return { ok: true, spec: { type, title, ...(unit ? { unit } : {}), data: { labels, series } } };
    }
    case "donut": {
      const slices = arr(data.slices).flatMap((s) => {
        if (!isObj(s)) return [];
        const label = clean(s.label, 40), value = num(s.value);
        return label && value !== null && value > 0 ? [{ label, value }] : [];
      }).slice(0, MAX_SLICES);
      if (!slices.length) return fail(`data.slices needs {label, value > 0} entries (at most ${MAX_SLICES}).`);
      return { ok: true, spec: { type, title, ...(unit ? { unit } : {}), data: { slices } } };
    }
    case "timeline": {
      const items = arr(data.items).flatMap((it) => {
        if (!isObj(it)) return [];
        const label = clean(it.label, 60);
        const start = clean(it.start, 7).toLowerCase();
        const end = clean(it.end, 7).toLowerCase() || undefined;
        const s = yearValue(start, now), e = end ? yearValue(end, now) : s;
        if (!label || s === null || e === null || e < s) return [];
        const note = clean(it.note) || undefined;
        return [{ label, start, ...(end ? { end } : {}), ...(note ? { note } : {}) }];
      }).slice(0, MAX_POINTS);
      if (!items.length) return fail('data.items needs {label, start, end?} with dates like "2024", "2024-06" or end "present".');
      return { ok: true, spec: { type, title, data: { items } } };
    }
    case "table": {
      const columns = arr(data.columns).slice(0, MAX_COLS).map((c) => clean(c, 40));
      if (!columns.length || columns.some((c) => !c)) return fail(`data.columns needs 1-${MAX_COLS} non-empty strings.`);
      const rows = arr(data.rows).slice(0, MAX_ROWS).flatMap((r) => (Array.isArray(r) ? [columns.map((_, j) => clean(r[j]))] : []));
      if (!rows.length) return fail(`data.rows needs 1-${MAX_ROWS} arrays of cells.`);
      return { ok: true, spec: { type, title, data: { columns, rows } } };
    }
    case "stats": {
      const items = arr(data.items).flatMap((it) => {
        if (!isObj(it)) return [];
        const label = clean(it.label, 40), value = clean(it.value, 40);
        const note = clean(it.note) || undefined;
        return label && value ? [{ label, value, ...(note ? { note } : {}) }] : [];
      }).slice(0, MAX_STATS);
      if (!items.length) return fail(`data.items needs 1-${MAX_STATS} {label, value, note?}.`);
      return { ok: true, spec: { type, title, data: { items } } };
    }
    case "graph": {
      const seen = new Set<string>();
      const nodes = arr(data.nodes).flatMap((n) => {
        if (!isObj(n)) return [];
        const id = clean(n.id, 40);
        if (!id || seen.has(id)) return [];
        seen.add(id);
        const group = clean(n.group, 24) || undefined;
        return [{ id, label: clean(n.label, 40) || id, ...(group ? { group } : {}) }];
      }).slice(0, MAX_POINTS);
      if (nodes.length < 2) return fail("data.nodes needs at least 2 {id, label, group?}.");
      const ids = new Set(nodes.map((n) => n.id));
      const keys = new Set<string>();
      const edges = arr(data.edges).flatMap((e) => {
        if (!isObj(e)) return [];
        const from = clean(e.from, 40), to = clean(e.to, 40);
        const key = [from, to].sort().join("\u0000");
        if (!ids.has(from) || !ids.has(to) || from === to || keys.has(key)) return [];
        keys.add(key);
        return [{ from, to }];
      }).slice(0, MAX_EDGES);
      return { ok: true, spec: { type, title, data: { nodes, edges } } };
    }
  }
}

/** The artifact's data as a table (columns + string rows): the visible "data" view and the Markdown export. */
export function artifactTable(spec: ArtifactSpec): { columns: string[]; rows: string[][] } {
  switch (spec.type) {
    case "bar":
    case "line":
    case "area":
      return { columns: ["", ...spec.data.series.map((s) => s.name)], rows: spec.data.labels.map((l, i) => [l, ...spec.data.series.map((s) => String(s.values[i]))]) };
    case "donut":
      return { columns: ["", "Value"], rows: spec.data.slices.map((s) => [s.label, String(s.value)]) };
    case "timeline":
      return { columns: ["Item", "Start", "End", "Note"], rows: spec.data.items.map((i) => [i.label, i.start, i.end ?? "", i.note ?? ""]) };
    case "table":
      return spec.data;
    case "stats":
      return { columns: ["Stat", "Value", "Note"], rows: spec.data.items.map((i) => [i.label, i.value, i.note ?? ""]) };
    case "graph":
      return { columns: ["From", "To"], rows: spec.data.edges.map((e) => [spec.data.nodes.find((n) => n.id === e.from)?.label ?? e.from, spec.data.nodes.find((n) => n.id === e.to)?.label ?? e.to]) };
  }
}
