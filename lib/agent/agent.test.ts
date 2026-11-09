import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMANDS, matchCommands, parseCommand } from "./commands.ts";
import { HISTORY_MAX, loadHistory, pushHistory, saveHistory, stepHistory } from "./history.ts";
import { formatRetry, spinFrame, statusSegments, verbAt, VERBS } from "./status.ts";
import { findEntry, resolveTarget } from "./targets.ts";

test("findEntry prefers id, then name or keyword", () => {
  const l = [{ id: "nimbus", name: "Nimbus", words: ["cloud"] }, { id: "stipple", name: "Stipple Dots", words: ["dither"] }];
  assert.equal(findEntry(l, "nimbus")?.id, "nimbus");
  assert.equal(findEntry(l, "dots")?.id, "stipple");
  assert.equal(findEntry(l, "Dither")?.id, "stipple");
  assert.equal(findEntry(l, "zzz"), undefined);
  assert.equal(findEntry(l, " "), undefined);
});

test("parseCommand splits name and arg, flags unknown", () => {
  assert.deepEqual(parseCommand("/Projects boiler frame"), { name: "/projects", arg: "boiler frame", known: true });
  assert.equal(parseCommand("/nope")?.known, false);
  assert.equal(parseCommand("what has he built"), null);
  assert.equal(parseCommand("  /help ")?.name, "/help");
});

test("every documented command parses as known", () => {
  assert.equal(COMMANDS.length, 12);
  for (const [c] of COMMANDS) assert.equal(parseCommand(c)?.known, true);
});

test("matchCommands completes prefixes and stops at an argument", () => {
  assert.deepEqual(matchCommands("/p").map(([c]) => c), ["/projects"]);
  assert.equal(matchCommands("/").length, COMMANDS.length);
  assert.deepEqual(matchCommands("/theme random"), []);
  assert.deepEqual(matchCommands("hello"), []);
});

test("pushHistory dedupes, orders newest first, caps at 50", () => {
  assert.deepEqual(pushHistory(["b", "a"], "a"), ["a", "b"]);
  assert.deepEqual(pushHistory(["a"], "   "), ["a"]);
  let l: string[] = [];
  for (let i = 0; i < 60; i++) l = pushHistory(l, `q${i}`);
  assert.equal(l.length, HISTORY_MAX);
  assert.equal(l[0], "q59");
});

test("stepHistory walks older and back to the live line", () => {
  const l = ["c", "b", "a"];
  assert.deepEqual(stepHistory(l, -1, 1), { idx: 0, value: "c" });
  assert.deepEqual(stepHistory(l, 2, 1), { idx: 2, value: "a" });
  assert.deepEqual(stepHistory(l, 0, -1), { idx: -1, value: "" });
  assert.deepEqual(stepHistory([], -1, 1), { idx: -1, value: "" });
});

test("history persists and survives junk or missing storage", () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  saveHistory(st, ["x", "y"]);
  assert.deepEqual(loadHistory(st), ["x", "y"]);
  mem.set("rithvik-agent-history", "{oops");
  assert.deepEqual(loadHistory(st), []);
  assert.deepEqual(loadHistory(undefined), []);
});

test("spinner and verbs advance with elapsed time", () => {
  assert.notEqual(spinFrame(0), spinFrame(80));
  assert.equal(spinFrame(0), spinFrame(800));
  assert.equal(verbAt(0), VERBS[0]);
  assert.equal(verbAt(1250), VERBS[1]);
  assert.equal(verbAt(1200 * VERBS.length), VERBS[0]);
});

test("formatRetry and status segments", () => {
  assert.equal(formatRetry(42), "42s");
  assert.equal(formatRetry(61), "2m");
  assert.equal(formatRetry(3600), "60m");
  assert.deepEqual(statusSegments({ kind: "idle", turns: 1 }).map((s) => s.text), ["● ready", "1 turn", "? for shortcuts"]);
  assert.equal(statusSegments({ kind: "idle", turns: 3 })[1].text, "3 turns");
  assert.equal(statusSegments({ kind: "limited", status: 429, retrySecs: 600 })[0].text, "⚠ rate limited · retry in 10m");
  assert.match(statusSegments({ kind: "limited", status: 503, retrySecs: 30 })[0].text, /unavailable · retry in 30s/);
  const busy = statusSegments({ kind: "busy", elapsedMs: 2500 });
  assert.equal(busy[2].text, "2.5s");
  assert.equal(busy[3].text, "esc to interrupt");
});

test("resolveTarget sends projects to the case sheet and others down the anchor chain", () => {
  assert.deepEqual(resolveTarget("project-boilerframe"), { kind: "case", slug: "boilerframe" });
  assert.deepEqual(resolveTarget("experience-hack-the-future"), { kind: "scroll", ids: ["experience-hack-the-future", "experience", "top"] });
  assert.deepEqual(resolveTarget("education"), { kind: "scroll", ids: ["education", "experience", "top"] });
  assert.deepEqual(resolveTarget("bento"), { kind: "scroll", ids: ["bento", "about", "top"] });
});
