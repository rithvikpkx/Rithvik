import { test } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_COMMANDS, COMMANDS, NEEDS_ARG, NO_ARG, runsOnClick, formatDocs, formatEmbed, isAdminCommand, matchCommands, parseCommand, parseTemp } from "./commands.ts";
import { HISTORY_MAX, loadHistory, pushHistory, saveHistory, stepHistory } from "./history.ts";
import { formatRetry, formatTokens, spinFrame, statusSegments, usageLines } from "./status.ts";

test("idle status line shows only what is known, in order", () => {
  const u = { tokens: 12431, limit: 60, remaining: 41, totalMs: 1900 };
  assert.deepEqual(statusSegments({ kind: "idle", usage: u }).map((s) => s.text), ["● ready", "41/60 left", "12.4k tok", "? for shortcuts"]);
  assert.deepEqual(statusSegments({ kind: "idle", usage: { ...u, reset: 1_000_000 + 23 * 60 }, now: 1_000_000_000 }).map((s) => s.text), ["● ready", "41/60 left", "resets in 23m", "12.4k tok", "? for shortcuts"]);
  assert.deepEqual(statusSegments({ kind: "idle", usage: { tokens: 0 } }).map((s) => s.text), ["● ready", "? for shortcuts"]);
  assert.equal(statusSegments({ kind: "idle", usage: { tokens: 0, limit: 60, remaining: 3 } })[1].tone, "warn");
});

test("formatTokens abbreviates", () => {
  assert.deepEqual([980, 1000, 1480, 12431, 123456].map(formatTokens), ["980", "1k", "1.5k", "12.4k", "123k"]);
});

test("usageLines: rate limit, tokens, timings, model; cache only when present", () => {
  const now = Date.UTC(2026, 10, 9, 12, 0, 0);
  const rows = Object.fromEntries(usageLines({ tokens: 3690, lastTokens: 2210, limit: 60, remaining: 41, reset: now / 1000 + 2280, ttfbMs: 420, totalMs: 1900 }, "gpt-x", now));
  assert.match(rows["Rate limit"], /^19\/60 used this hour · 41 left · resets .+ \(in 38m\)$/);
  assert.equal(rows["Tokens"], "3,690 this session · 2,210 last turn");
  assert.equal(rows["Last turn"], "first byte 0.4s · total 1.9s");
  assert.equal(rows["Model"], "gpt-x");
  assert.equal("Cache" in rows, false);
  const bare = Object.fromEntries(usageLines({ tokens: 0, cache: "MISS" }, undefined, now));
  assert.deepEqual(Object.keys(bare), ["Tokens", "Cache"]);
  assert.equal(bare["Tokens"], "none yet this session");
});
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
  assert.equal(COMMANDS.length, 26);
  for (const [c] of COMMANDS) assert.equal(parseCommand(c)?.known, true);
});

test("every visitor command is documented once and help chips fill only when an argument is required", () => {
  assert.equal(new Set(COMMANDS.map(([c]) => c)).size, COMMANDS.length);
  for (const c of ["/home", "/status", "/buffett", "/compose", "/play", "/palette", "/lite", "/share", "/download", "/voice"]) assert.equal(parseCommand(c)?.known, true, c);
  for (const [c] of COMMANDS) if (NO_ARG.has(c)) assert.equal(runsOnClick(c), true);
  assert.equal(runsOnClick("/palette"), false);
  assert.equal([...NEEDS_ARG].every((c) => !NO_ARG.has(c)), true);
});

test("matchCommands completes prefixes and stops at an argument", () => {
  assert.deepEqual(matchCommands("/pr").map(([c]) => c), ["/projects"]);
  assert.deepEqual(matchCommands("/p").map(([c]) => c), ["/projects", "/play", "/palette"]);
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
});

test("formatRetry and status segments", () => {
  assert.equal(formatRetry(42), "42s");
  assert.equal(formatRetry(61), "2m");
  assert.equal(formatRetry(3600), "60m");
  assert.deepEqual(statusSegments({ kind: "idle" }).map((s) => s.text), ["● ready", "? for shortcuts"]);
  assert.equal(statusSegments({ kind: "limited", status: 429, retrySecs: 600 })[0].text, "⚠ rate limited · retry in 10m");
  assert.match(statusSegments({ kind: "limited", status: 503, retrySecs: 30 })[0].text, /unavailable · retry in 30s/);
  const busy = statusSegments({ kind: "busy", elapsedMs: 2500, verb: "Recursing" });
  assert.equal(busy[1].text, "Recursing…");
  assert.equal(busy[2].text, "2.5s");
  assert.equal(busy[3].text, "esc to interrupt");
});

test("resolveTarget sends projects to the case sheet and others down the anchor chain", () => {
  assert.deepEqual(resolveTarget("project-boilerframe"), { kind: "case", slug: "boilerframe" });
  assert.deepEqual(resolveTarget("experience-hack-the-future"), { kind: "scroll", ids: ["experience-hack-the-future", "experience", "top"] });
  assert.deepEqual(resolveTarget("education"), { kind: "scroll", ids: ["education", "experience", "top"] });
  assert.deepEqual(resolveTarget("bento"), { kind: "scroll", ids: ["bento", "about", "top"] });
});

test("admin commands stay out of the visitor palette and /help list", () => {
  assert.equal(COMMANDS.some(([c]) => /embed|temp|docs|sync/.test(c)), false);
  assert.deepEqual(matchCommands("/em"), []);
  assert.deepEqual(matchCommands("/em", true).map(([c]) => c), ["/embed"]);
  assert.equal(matchCommands("/", true).length, COMMANDS.length + ADMIN_COMMANDS.length);
  assert.deepEqual(matchCommands("/resume s", true).map(([c]) => c), ["/resume sync"]);
  assert.deepEqual(matchCommands("/theme random", true), []);
});

test("isAdminCommand matches /resume only with the sync argument", () => {
  assert.equal(isAdminCommand({ name: "/embed", arg: "" }), true);
  assert.equal(isAdminCommand({ name: "/resume", arg: "sync" }), true);
  assert.equal(isAdminCommand({ name: "/resume", arg: "" }), false);
  assert.equal(isAdminCommand({ name: "/projects", arg: "" }), false);
});

test("parseTemp accepts 0-1.2 and refuses the rest", () => {
  assert.deepEqual(parseTemp("0.7"), { ok: true, value: 0.7 });
  assert.deepEqual(parseTemp(" 1.2 "), { ok: true, value: 1.2 });
  assert.deepEqual(parseTemp("0"), { ok: true, value: 0 });
  assert.deepEqual(parseTemp(".5"), { ok: true, value: 0.5 });
  assert.equal(parseTemp("1.3").ok, false);
  assert.equal(parseTemp("-1").ok, false);
  assert.equal(parseTemp("hot").ok, false);
  assert.equal(parseTemp("").ok, false);
});

test("admin result formatters", () => {
  assert.equal(formatEmbed({ projects: 6, experience: 4, education: 1, site_content: 20, errors: [] }), "31 records (6 projects, 4 roles, 1 education, 20 site)");
  assert.match(formatEmbed({ projects: 1, experience: 0, education: 0, site_content: 0, errors: ["boom"] }), /1 error: boom/);
  assert.equal(formatDocs([]), "No documents uploaded");
  assert.equal(formatDocs([{ filename: "a.pdf", chunk_count: 3 }]), "a.pdf (3 chunks)");
});
