import { test } from "node:test";
import assert from "node:assert/strict";
import { artifactTable, clean, parseArtifact, type ArtifactSpec, sanitizeVisual } from "./artifacts.ts";
import { screenCalls, toolDefs, validateToolCall, type Allowed } from "./tools.ts";
import { artifactMarkdown, buildTranscriptMarkdown } from "../transcript.ts";

const NOW = new Date(Date.UTC(2026, 10, 9));
const ok = (v: unknown) => { const r = parseArtifact(v, NOW); assert.ok(r.ok, r.ok ? "" : r.error); return (r as { ok: true; spec: ArtifactSpec }).spec; };
const bad = (v: unknown) => { const r = parseArtifact(v, NOW); assert.equal(r.ok, false); return r.ok ? "" : r.error; };

test("clean drops markup, URLs and control characters, collapses space, caps length", () => {
  assert.equal(clean("a <b>x</b>\u0007 see https://evil.example/p?q=1 and www.x.com ok"), "a b x /b see and ok");
  assert.equal(clean("javascript:alert(1)"), "");
  assert.equal(clean("Data: 5 projects"), "Data: 5 projects"); // a label that merely starts with "data:" survives
  assert.equal(clean(42), "42");
  assert.equal(clean(NaN), "");
  assert.equal(clean({}), "");
  assert.equal(clean("x".repeat(200)).length, 80);
});

test("bar/line/area: labels and series are rebuilt; bad series are dropped, not repaired", () => {
  const spec = ok({
    type: "Bar", title: " Projects by year ", unit: "n", evil: "<script>", data: {
      labels: ["2023", "2024"], extra: 1,
      series: [{ name: "Built", values: [1, 2], color: "red" }, { name: "Short", values: [1] }, { name: "NaN", values: [1, null] }, { name: "Str", values: [1, "2"] }, "junk"],
    },
  });
  assert.deepEqual(spec, { type: "bar", title: "Projects by year", unit: "n", data: { labels: ["2023", "2024"], series: [{ name: "Built", values: [1, 2] }] } });
  assert.match(bad({ type: "line", title: "t", data: { labels: ["only"], series: [{ name: "a", values: [1] }] } }), /labels/); // a line needs 2 points
  assert.match(bad({ type: "bar", title: "t", data: { labels: ["a"], series: [{ name: "a", values: [Infinity] }] } }), /series/);
  assert.match(bad({ type: "bar", title: "t", data: { labels: ["a", ""], series: [{ name: "a", values: [1, 2] }] } }), /labels/);
});

test("limits: 24 points, 8 series; longer values are cut to the label count", () => {
  const labels = Array.from({ length: 40 }, (_, i) => `L${i}`);
  const series = Array.from({ length: 12 }, (_, i) => ({ name: `S${i}`, values: Array.from({ length: 50 }, (_, j) => j) }));
  const s = ok({ type: "area", title: "t", data: { labels, series } }) as Extract<ArtifactSpec, { type: "area" }>;
  assert.equal(s.data.labels.length, 24);
  assert.equal(s.data.series.length, 8);
  assert.equal(s.data.series[0].values.length, 24);
});

test("donut keeps positive slices only, at most 8", () => {
  const slices = [...Array.from({ length: 10 }, (_, i) => ({ label: `s${i}`, value: i })), { label: "neg", value: -3 }];
  const s = ok({ type: "donut", title: "t", data: { slices } }) as Extract<ArtifactSpec, { type: "donut" }>;
  assert.equal(s.data.slices.length, 8);
  assert.ok(s.data.slices.every((x) => x.value > 0));
  assert.match(bad({ type: "donut", title: "t", data: { slices: [{ label: "z", value: 0 }] } }), /slices/);
});

test("timeline: dates must be YYYY / YYYY-MM / present and end must not precede start", () => {
  const s = ok({ type: "timeline", title: "Roles", data: { items: [
    { label: "A", start: "2024-06", end: "Present", note: "n" }, { label: "B", start: "2022" }, { label: "bad", start: "last year" }, { label: "back", start: "2024", end: "2020" }, { label: "", start: "2020" },
  ] } }) as Extract<ArtifactSpec, { type: "timeline" }>;
  assert.deepEqual(s.data.items, [{ label: "A", start: "2024-06", end: "present", note: "n" }, { label: "B", start: "2022" }]);
  assert.match(bad({ type: "timeline", title: "t", data: { items: [{ label: "x", start: "soon" }] } }), /items/);
});

test("table: at most 6 columns x 12 rows, rows padded or cut to the columns, cells are plain text", () => {
  const s = ok({ type: "table", title: "T", data: { columns: ["a", "b", "c", "d", "e", "f", "g"], rows: Array.from({ length: 20 }, () => ["<i>x</i>", 2, "https://x.y", null, "5", "6", "7"]) } }) as Extract<ArtifactSpec, { type: "table" }>;
  assert.equal(s.data.columns.length, 6);
  assert.equal(s.data.rows.length, 12);
  assert.deepEqual(s.data.rows[0], ["i x /i", "2", "", "", "5", "6"]);
  assert.match(bad({ type: "table", title: "T", data: { columns: [], rows: [["x"]] } }), /columns/);
  assert.match(bad({ type: "table", title: "T", data: { columns: ["a"], rows: "x" } }), /rows/);
});

test("stats and graph: shapes rebuilt, dangling or duplicate edges dropped", () => {
  const st = ok({ type: "stats", title: "S", data: { items: [{ label: "Projects", value: 8, note: "built" }, { label: "", value: 1 }, { label: "x", value: {} }] } }) as Extract<ArtifactSpec, { type: "stats" }>;
  assert.deepEqual(st.data.items, [{ label: "Projects", value: "8", note: "built" }]);
  const g = ok({ type: "graph", title: "G", data: { nodes: [{ id: "a", label: "A", group: "x" }, { id: "b" }, { id: "a", label: "dup" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }, { from: "a", to: "zzz" }, { from: "a", to: "a" }] } }) as Extract<ArtifactSpec, { type: "graph" }>;
  assert.deepEqual(g.data.nodes, [{ id: "a", label: "A", group: "x" }, { id: "b", label: "b" }]);
  assert.deepEqual(g.data.edges, [{ from: "a", to: "b" }]);
  assert.match(bad({ type: "graph", title: "G", data: { nodes: [{ id: "a" }], edges: [] } }), /nodes/);
});

test("top level: unknown type, missing title, bad data, JSON strings", () => {
  assert.match(bad({ type: "pie", title: "t", data: {} }), /type must be one of/);
  assert.match(bad({ type: "bar", data: {} }), /title/);
  assert.match(bad({ type: "bar", title: "t", data: "nope" }), /data/);
  assert.match(bad("{oops"), /JSON/);
  assert.match(bad([1]), /object/);
  const s = ok(JSON.stringify({ type: "stats", title: "t", data: JSON.stringify({ items: [{ label: "a", value: "1" }] }) }));
  assert.equal(s.type, "stats");
  // the rebuilt spec parses to itself: the client's second pass is a no-op
  assert.deepEqual(ok(s), s);
});

test("artifactTable gives every form a table", () => {
  const s = ok({ type: "bar", title: "t", data: { labels: ["a", "b"], series: [{ name: "x", values: [1, 2] }, { name: "y", values: [3, 4] }] } });
  assert.deepEqual(artifactTable(s), { columns: ["", "x", "y"], rows: [["a", "1", "3"], ["b", "2", "4"]] });
});

const A: Allowed = { projects: [], roles: [], games: [], looks: [], places: [] };
const call = (args: unknown, id = "c1") => ({ id, name: "render_artifact", arguments: typeof args === "string" ? args : JSON.stringify(args) });
const stats = { type: "stats", title: "Hi", data: { items: [{ label: "a", value: "1" }] } };

test("render_artifact is in the registry, valid calls carry the spec, and it needs no confirmation", async () => {
  const def = toolDefs(A).find((d) => d.function.name === "render_artifact")!;
  assert.deepEqual((def.function.parameters as { required: string[] }).required, ["type", "title", "data"]);
  const v = validateToolCall(call(stats), A)!;
  assert.deepEqual(v.args, { type: "stats", title: "Hi" });
  assert.equal(v.artifact?.type, "stats");
  const r = await screenCalls([call(stats, "a"), call(stats, "b")], A);
  assert.equal(r.kept.length, 1); // one artifact per step
  assert.match(r.replies[0].content, /Rendered/);
  assert.match(r.replies[1].content, /one artifact/);
});

test("render_artifact: a bad spec is rejected with a reason the model can act on", async () => {
  assert.equal(validateToolCall(call({ type: "bar", title: "t", data: { labels: ["a"], series: [] } }), A), null);
  const r = await screenCalls([call({ type: "bar", title: "t", data: { labels: ["a"], series: [] } })], A);
  assert.equal(r.kept.length, 0);
  assert.match(r.replies[0].content, /^Rejected: data\.series/);
});

test("Markdown export carries the title and a table of the data; pipes are escaped", () => {
  const s = ok({ type: "table", title: "A | B", data: { columns: ["Project", "Area"], rows: [["BoilerFrame", "CV | video"]] } });
  assert.deepEqual(artifactMarkdown(s), ["**A \\| B** _(table)_", "", "| Project | Area |", "| --- | --- |", "| BoilerFrame | CV \\| video |", ""]);
  const md = buildTranscriptMarkdown([{ kind: "user", text: "q" }, { kind: "artifact", spec: ok(stats) }, { kind: "answer", text: "done" }], 0);
  assert.match(md, /\*\*Hi\*\* _\(stats\)_\n\n\| Stat \| Value \| Note \|/);
});

test("html visuals keep styles and inline SVG but lose scripts, handlers, links and every external load", () => {
  const evil = `<style>.a{background:url(https://x.io/t.png);fill:url(#g)} @import "https://e.com/x.css";</style><div class="a" onclick="alert(1)">ok</div><script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">l</a><svg><use href="https://e/x.svg#a"/><rect fill="url(#g)"/></svg><iframe src="//e"></iframe><meta http-equiv=refresh content="0;url=//e">`;
  const out = sanitizeVisual(evil);
  for (const bad of ["script", "onclick", "onerror", "https:", "javascript", "@import", "<img", "<iframe", "<use", "<meta", "href"]) assert.ok(!out.toLowerCase().includes(bad), `${bad} survived: ${out}`);
  assert.ok(out.includes("fill:url(#g)") && out.includes("<rect") && out.includes(">ok</div>"));
  const p = parseArtifact({ type: "html", title: "Card", data: { html: "<div style='color:var(--accent)'>Hello there</div>", height: 9999 } });
  assert.ok(p.ok && p.spec.type === "html" && p.spec.data.height === 640);
});
