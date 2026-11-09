// Pure helpers for scripts/eval-agent.mjs: stream parsing and scoring. No I/O, so they are unit-tested.

/** Splits a raw /api/chat body into the visible answer and the structured data (frames joined by NUL).
 *  v2 (lib/suggestion-protocol.ts) puts text runs between \0{json}\0 frames, so even NUL-split segments are
 *  answer text and odd ones are frames; v1 (`answer\0RAG_SUGGESTIONS\0{json}`) is recognised by its label. */
export function splitStream(raw) {
  const seg = raw.split("\u0000");
  if (seg.length === 1) return { answer: raw, tail: "" };
  if (seg[1] === "RAG_SUGGESTIONS") return { answer: seg[0], tail: seg.slice(1).join("\u0000") };
  return { answer: seg.filter((_, i) => i % 2 === 0).join(""), tail: seg.filter((_, i) => i % 2 === 1).join("\u0000") };
}

/** Pulls every JSON value out of the structured tail (frames may be NUL-separated, and v1 has a label frame first). */
export function parseFrames(tail) {
  const out = [];
  for (const part of tail.split("\u0000")) {
    const s = part.trim();
    if (!s || !/^[{[]/.test(s)) continue;
    try { out.push(JSON.parse(s)); } catch { /* partial or unknown frame: ignore */ }
  }
  return out;
}

/** Normalises whatever tool/action shapes the frames carry into [{ name, target }].
 *  Understands v1 `actions: [{type, target}]` plus `tools`, `tool_calls` and `{tool|name, args}` style entries. */
export function extractTools(frames) {
  const found = [];
  const add = (name, target) => { if (typeof name === "string" && name) found.push({ name, target: typeof target === "string" ? target : "" }); };
  const visit = (v, key) => {
    if (Array.isArray(v)) return v.forEach((x) => visit(x, key));
    if (!v || typeof v !== "object") return;
    if (["actions", "tools", "tool_calls", "toolCalls"].includes(key) || "type" in v || "tool" in v || v.t === "tool") {
      add(v.type ?? v.tool ?? v.name, v.target ?? v.args?.target ?? v.args?.slug ?? v.args?.id ?? v.args?.place ??v.arguments?.target ?? v.arguments?.slug);
    }
    for (const [k, x] of Object.entries(v)) if (typeof x === "object") visit(x, k);
  };
  frames.forEach((f) => visit(f, ""));
  // A v1 frame is {suggestions, actions}: the top-level object itself has no `type`, so only its children were added.
  return found;
}

/** First token count any frame reports (`usage.total_tokens`, `tokens`), else null. */
export function extractTokens(frames) {
  for (const f of frames) {
    const t = f?.usage?.total_tokens ?? f?.tokens ?? f?.usage?.totalTokens;
    if (typeof t === "number") return t;
  }
  return null;
}

// v1 action types that stand in for a tool name until the route speaks tools natively.
const ALIAS = {
  open_project: (t) => t.name === "scroll_to" && /^project-/.test(t.target),
  draft_email: (t) => t.name === "open_composer",
  show_section: (t) => t.name === "scroll_to",
};

/** True when `expected` (a tool name) was called, directly or through its v1 alias. */
export function hasTool(expected, tools) {
  return tools.some((t) => t.name === expected || ALIAS[expected]?.(t));
}

const DECLINE_RE = /(don'?t have (that|this|enough|any)|do not have (that|this)|not (listed|specified|mentioned|available|in (the|my) (context|information))|no information|specifically to answer|only set up to discuss|only (here|able) to (answer|discuss)|can'?t (share|help|provide|do that|assist)|cannot (share|help|provide|assist)|not able to|unable to|reach out to rithvik|isn'?t something|outside (of )?(my|the) scope|here to (help|answer) (you )?(with|about) (questions about )?rithvik)/i;

/** True when the answer reads as a refusal or redirect. */
export function isDecline(answer) {
  return DECLINE_RE.test(answer);
}

/** Does `text` satisfy one include entry? A string is a substring; an array is any-of. Case-insensitive. */
function hit(text, entry) {
  const t = text.toLowerCase();
  return (Array.isArray(entry) ? entry : [entry]).some((e) => t.includes(String(e).toLowerCase()));
}

/** Scores one case against its result ({answer, tools}). Returns { pass, checks: [{name, ok, detail}] }. */
export function scoreCase(c, r) {
  const checks = [];
  const check = (name, ok, detail = "") => checks.push({ name, ok, detail });
  if (c.decline) check("declines", isDecline(r.answer));
  else if (!c.tool) check("answers", r.answer.trim().length > 0 && !isDecline(r.answer), "refused or empty");
  for (const e of c.include ?? []) check("include", hit(r.answer, e), JSON.stringify(e));
  for (const e of c.exclude ?? []) check("exclude", !hit(r.answer, e), JSON.stringify(e));
  for (const re of c.excludeRe ?? []) check("excludeRe", !new RegExp(re, "i").test(r.answer), re);
  if (c.tool) check("tool", hasTool(c.tool, r.tools), `${c.tool} (got ${r.tools.map((t) => t.name).join(", ") || "none"})`);
  return { pass: checks.every((k) => k.ok), checks };
}

/** Median of a number list (0 for empty). */
export function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

/** Per-category pass counts plus overall latency stats. */
export function summarize(rows) {
  const cats = {};
  for (const r of rows) {
    const c = (cats[r.category] ??= { pass: 0, total: 0 });
    c.total++;
    if (r.pass) c.pass++;
  }
  const ok = rows.filter((r) => !r.error);
  return {
    pass: rows.filter((r) => r.pass).length,
    total: rows.length,
    categories: cats,
    ttfbMedianMs: median(ok.map((r) => r.ttfbMs)),
    totalMedianMs: median(ok.map((r) => r.totalMs)),
    totalMaxMs: Math.max(0, ...ok.map((r) => r.totalMs)),
  };
}
