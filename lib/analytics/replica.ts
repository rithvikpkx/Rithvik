/** Stored agent_messages rows -> the agent window's transcript items, so the admin replays a conversation in the real
 *  Transcript component. Pure (node:test). Assistant rows gain a muted telemetry note the visitor never saw. */
import type { Item } from "../../components/site/agent/types";
import type { MessageRow } from "../agent/chats";

type Row = Pick<MessageRow, "role" | "content" | "tools" | "sources" | "model" | "tokens_in" | "tokens_out" | "ttfb_ms" | "total_ms" | "status" | "error" | "cached" | "created_at">;

const short = (v: unknown, max = 80): string => {
  if (v === undefined || v === null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};
const ms = (n: number) => (n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`);

/** The sources the answer cited, in the transcript's footnote shape (malformed entries dropped). */
function sourcesOf(v: unknown): { n: number; label: string; anchor?: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) => (s && typeof s === "object" && typeof (s as { n?: unknown }).n === "number" && typeof (s as { label?: unknown }).label === "string"
    ? [{ n: (s as { n: number }).n, label: (s as { label: string }).label, ...(typeof (s as { anchor?: unknown }).anchor === "string" ? { anchor: (s as { anchor: string }).anchor } : {}) }]
    : []));
}

/** One telemetry line for an answer: model, tokens, timings, cache and status. */
export function telemetry(r: Row): string {
  const tokens = (r.tokens_in ?? 0) + (r.tokens_out ?? 0);
  return [
    r.model, tokens ? `${tokens.toLocaleString("en-US")} tokens` : null,
    r.ttfb_ms != null ? `first byte ${ms(r.ttfb_ms)}` : null, r.total_ms != null ? `total ${ms(r.total_ms)}` : null,
    r.cached ? "cached" : null, r.status != null && r.status !== 200 ? `status ${r.status}` : null,
  ].filter(Boolean).join(" · ");
}

/** Messages in stored order -> transcript items (ids are positions, stable for React keys). */
export function rowsToItems(messages: Row[], opts: { telemetry?: boolean } = {}): Item[] {
  const out: Item[] = [];
  const push = (it: Record<string, unknown>) => out.push({ id: out.length + 1, ...it } as Item);
  for (const m of messages) {
    const at = Date.parse(m.created_at);
    if (m.role === "user") push({ kind: "user", text: m.content, at });
    else if (m.role === "tool") {
      const t = (m.tools && typeof m.tools === "object" ? m.tools : {}) as { name?: unknown; args?: unknown; result?: unknown };
      push({ kind: "tool", name: typeof t.name === "string" ? t.name : m.content || "tool", args: short(t.args), result: t.result === undefined ? "done" : short(t.result, 160), at });
    } else {
      if (m.content) push({ kind: "answer", text: m.content, streaming: false, at });
      const src = sourcesOf(m.sources);
      if (src.length) push({ kind: "sources", items: src, at });
      if (m.error) push({ kind: "note", text: `Error: ${m.error}`, tone: "warn", at });
      if (opts.telemetry !== false) { const t = telemetry(m); if (t) push({ kind: "note", text: t, at }); }
    }
  }
  return out;
}
