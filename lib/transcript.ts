/**
 * Builds the Markdown export of an agent conversation from the transcript rows the panel shows:
 * every message, the rewrite and search rows, tool calls with their confirmation outcome, answers,
 * footnote sources, suggestions and notes, each stamped, under a header (site, date, session, model).
 *
 * Pure and dependency-free so it can be unit-tested with node:test; the same function feeds the
 * header Copy / Download buttons and the /export command.
 */

/** The rows the export understands. Structurally a subset of the panel's `Item`, so the
 *  hook's items pass straight in; `banner` and `help` are chrome and are skipped. */
export type TranscriptItem =
  | { kind: "user"; text: string; at?: number }
  | { kind: "tool"; name: string; args: string; result?: string; lines?: [string, string][]; at?: number }
  | { kind: "answer"; text: string; at?: number }
  | { kind: "suggest"; chips: string[]; at?: number }
  | { kind: "ask"; question: string; state: "pending" | "yes" | "no" | "always" | "auto"; tool?: { name: string; args: string }; detail?: string[]; once?: boolean; at?: number }
  | { kind: "sources"; items: { n: number; label: string; anchor?: string }[]; at?: number }
  | { kind: "note"; text: string; tone?: "warn"; at?: number }
  | { kind: "banner" | "help"; at?: number };

/** Facts for the header; anything unknown is left out. */
export type TranscriptMeta = {
  site?: string;
  /** Server conversation id, or null before the first answered turn. */
  session?: string | null;
  model?: string;
  /** Active design id (`?theme=`). */
  design?: string;
  /** Answer-model tokens used this session. */
  tokens?: number;
};

const SITE = "rithvik.ai";
const pad = (n: number) => String(n).padStart(2, "0");

/** Formats an epoch-ms timestamp as `YYYY-MM-DD HH:MM` in the viewer's locale
 *  offset. Falls back to an empty string for a missing/invalid value. */
export function formatTimestamp(at: number | undefined): string {
  if (typeof at !== "number" || !Number.isFinite(at)) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `HH:MM:SS` for a row, or "" when the row has no usable time. */
function clock(at: number | undefined): string {
  if (typeof at !== "number" || !Number.isFinite(at)) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** A filename-safe stamp for the downloaded file, e.g. `rag-chat-2026-08-14-1532.md`. */
export function transcriptFilename(now: number): string {
  const stamp = formatTimestamp(now).replace(" ", "-").replace(":", "");
  return stamp ? `rag-chat-${stamp}.md` : "rag-chat.md";
}

/** What the visitor chose on a confirmation row. A once-only send reads "sent", never "always". */
function outcome(i: Extract<TranscriptItem, { kind: "ask" }>): string {
  if (i.state === "pending") return "awaiting confirmation";
  if (i.state === "no") return i.once ? "declined, not sent" : "declined";
  if (i.state === "always") return "allowed (always this session)";
  if (i.state === "auto") return "allowed automatically (always this session)";
  return i.once ? "confirmed and sent" : "allowed";
}

/** A line break survives Markdown only with two trailing spaces. */
const keepBreaks = (s: string) => s.trim().replace(/\n/g, "  \n");

/**
 * Renders the conversation as Markdown. `exportedAt` is passed in rather than read from the clock,
 * so the output is deterministic. Empty answers (the placeholder a stream writes into) are dropped.
 */
export function buildTranscriptMarkdown(items: TranscriptItem[], exportedAt: number, meta: TranscriptMeta = {}): string {
  const body = items.filter((i) => i.kind !== "banner" && i.kind !== "help" && !(i.kind === "answer" && !i.text.trim()));
  const turns = body.filter((i) => i.kind === "user").length;

  const out: string[] = [`# Chat with RAG — ${meta.site ?? SITE}`, ""];
  const head: [string, string | undefined][] = [
    ["Site", meta.site ?? SITE],
    ["Exported", formatTimestamp(exportedAt) || undefined],
    ["Session", meta.session || undefined],
    ["Model", meta.model || undefined],
    ["Design", meta.design || undefined],
    ["Prompts",body.length ? String(turns) : undefined],
    ["Tokens", meta.tokens ? String(meta.tokens) : undefined],
  ];
  for (const [k, v] of head) if (v) out.push(`- **${k}:** ${v}`);
  out.push("");

  if (body.length === 0) return [...out, "_No messages in this conversation._", ""].join("\n");
  out.push("---", "");

  let agent = false; // true once this reply's "RAG" heading has been written
  let list = false; // inside a run of tool bullets, which stay tight (no blank line between)
  const para = (...lines: string[]) => { if (list) { out.push(""); list = false; } out.push(...lines); };
  for (const i of body) {
    const t = clock(i.at);
    if (i.kind === "user") {
      agent = false;
      para(`### You${t ? ` · ${t}` : ""}`, "", keepBreaks(i.text), "");
      continue;
    }
    if (!agent) { agent = true; para(`### RAG${t ? ` · ${t}` : ""}`, ""); }
    switch (i.kind) {
      case "tool":
        list = true;
        out.push(`- **${i.name}**(${i.args})${i.result !== undefined ? ` — ${i.result}` : ""}`);
        for (const [k, v] of i.lines ?? []) out.push(`  - ${k}: ${v}`);
        break;
      case "ask": {
        const call = i.tool ? `**${i.tool.name}**(${i.tool.args}) — ${i.question}` : `**${i.question}**`;
        list = true;
        out.push(`- ${call} → **${outcome(i)}**`);
        for (const d of i.detail ?? []) out.push(`  - ${d}`);
        break;
      }
      case "answer":
        para(i.text.trim(), "");
        break;
      case "sources":
        para("_Sources_", "", ...i.items.map((s) => `- [${s.n}] ${s.label}`), "");
        break;
      case "suggest": {
        const s = i.chips.filter((x) => x.trim().length > 0);
        if (s.length) para(`_Suggested follow-ups: ${s.map((x) => `"${x.trim()}"`).join(" · ")}_`, "");
        break;
      }
      case "note":
        para(`> **${i.tone === "warn" ? "Notice" : "Note"}:** ${i.text.trim()}`, "");
        break;
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
