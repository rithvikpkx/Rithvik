// Golden eval for the site agent: POSTs each case in evals/agent.jsonl to a running server and scores the reply.
//
//   npm run eval -- --base http://localhost:3000 [--model gpt-4o] [--only <id-prefix>] [--rotate-ip]
//
// --model sends `x-eval-model: <id>` (plus `x-eval-token: $EVAL_TOKEN`); the route must honour the header only
// when EVAL_TOKEN matches, and ignore it otherwise. Without --model nothing is sent, so it works against any build.
// --rotate-ip sends a distinct x-forwarded-for per case so a LOCAL server's per-IP limit (30/hr) does not stop a
// 40-case run. Vercel overwrites that header, so this does nothing against a deployed site.
// Everything after the first NUL byte in the stream is treated as structured data, so v1 and v2 framing both parse.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extractTokens, extractTools, parseFrames, scoreCase, splitStream, summarize } from "../evals/lib.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
};
const base = String(opt("base", "http://localhost:3000")).replace(/\/$/, "");
const model = opt("model", null);
const only = opt("only", null);
const rotate = opt("rotate-ip", false) === true;

const cases = readFileSync(new URL("../evals/agent.jsonl", import.meta.url), "utf8")
  .split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l))
  .filter((c) => !only || c.id.startsWith(only));

/** Sends one case and returns timings, the visible answer and parsed tool calls. */
async function ask(c, n) {
  const headers = { "Content-Type": "application/json" };
  if (model) { headers["x-eval-model"] = String(model); if (process.env.EVAL_TOKEN) headers["x-eval-token"] = process.env.EVAL_TOKEN; }
  if (rotate) headers["x-forwarded-for"] = `10.${(n >> 8) & 255}.${n & 255}.${1 + (Date.now() % 250)}`;
  const t0 = performance.now();
  const res = await fetch(`${base}/api/chat`, { method: "POST", headers, body: JSON.stringify({ message: c.q, messages: c.history ?? [], offered: [] }) });
  if (!res.ok) return { error: `HTTP ${res.status}${res.status === 429 ? " (rate limited: use --rotate-ip on a local server)" : ""}`, answer: "", tools: [], ttfbMs: 0, totalMs: Math.round(performance.now() - t0), tokens: null };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let raw = "", ttfb = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
    if (!ttfb && splitStream(raw).answer.trim()) ttfb = performance.now() - t0; // first visible text, not the NUL trailer
  }
  const total = performance.now() - t0;
  const { answer, tail } = splitStream(raw);
  const frames = parseFrames(tail);
  const hdrTokens = Number(res.headers.get("x-usage-tokens") ?? res.headers.get("x-tokens"));
  return { answer: answer.trim(), tools: extractTools(frames), tokens: extractTokens(frames) ?? (Number.isFinite(hdrTokens) && hdrTokens > 0 ? hdrTokens : null), ttfbMs: Math.round(ttfb), totalMs: Math.round(total) };
}

const rows = [];
for (const [n, c] of cases.entries()) {
  let r;
  try { r = await ask(c, n); } catch (e) { r = { error: e instanceof Error ? e.message : String(e), answer: "", tools: [], ttfbMs: 0, totalMs: 0, tokens: null }; }
  const s = r.error ? { pass: false, checks: [{ name: "request", ok: false, detail: r.error }] } : scoreCase(c, r);
  rows.push({ id: c.id, category: c.category, q: c.q, pass: s.pass, failed: s.checks.filter((k) => !k.ok).map((k) => `${k.name} ${k.detail}`.trim()), ...r });
  const x = rows[rows.length - 1];
  console.log(`${x.pass ? "PASS" : "FAIL"}  ${x.id.padEnd(22)} ${String(x.ttfbMs).padStart(5)}ms ttfb  ${String(x.totalMs).padStart(5)}ms total  ${x.tokens ?? "-"} tok${x.pass ? "" : "   <- " + x.failed.join("; ")}`);
}

const sum = summarize(rows);
console.log("\ncategory      pass");
for (const [k, v] of Object.entries(sum.categories)) console.log(`${k.padEnd(13)} ${v.pass}/${v.total}`);
console.log(`\ntotal ${sum.pass}/${sum.total} · ttfb median ${sum.ttfbMedianMs}ms · total median ${sum.totalMedianMs}ms · max ${sum.totalMaxMs}ms`);

mkdirSync(new URL("../evals/results/", import.meta.url), { recursive: true });
const label = String(model ?? "default").replace(/[^\w.-]/g, "_");
const file = new URL(`../evals/results/${label}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, import.meta.url);
writeFileSync(file, JSON.stringify({ base, model: model ?? "server default", at: new Date().toISOString(), summary: sum, rows }, null, 2));
console.log(`wrote ${file.pathname}`);
process.exit(sum.pass === sum.total ? 0 : 1);
