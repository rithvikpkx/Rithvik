/**
 * Builds a Markdown transcript of a RAG chat session, including the follow-up
 * suggestions the bot offered on each turn.
 *
 * Pure and dependency-free so it can be unit-tested with node:test, and so the
 * export button never has to reach for anything server-side.
 */

export interface TranscriptMessage {
  role: "user" | "bot";
  content: string;
  /** Follow-ups offered after this bot turn, if any. */
  suggestions?: string[];
  /** Epoch ms. Optional — older messages in a session may predate it. */
  at?: number;
  /** Marks an error / rate-limit notice so the export doesn't present it as a real answer. */
  isNotice?: boolean;
}

const SITE = "rithvik.ai";

/** Formats an epoch-ms timestamp as `YYYY-MM-DD HH:MM` in the viewer's locale
 *  offset. Falls back to an empty string for a missing/invalid value. */
export function formatTimestamp(at: number | undefined): string {
  if (typeof at !== "number" || !Number.isFinite(at)) return "";
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A filename-safe stamp for the downloaded file, e.g. `2026-08-14-1532`. */
export function transcriptFilename(now: number): string {
  const stamp = formatTimestamp(now).replace(" ", "-").replace(":", "");
  return stamp ? `rag-chat-${stamp}.md` : "rag-chat.md";
}

/**
 * Renders the conversation as Markdown.
 *
 * Skips the welcome message and any still-streaming empty placeholder, since
 * neither is part of what the visitor actually asked or was told. `exportedAt`
 * is passed in rather than read from the clock so the output is deterministic
 * and the function stays testable.
 */
export function buildTranscriptMarkdown(
  messages: TranscriptMessage[],
  exportedAt: number,
  opts: { skipFirst?: boolean } = {},
): string {
  const { skipFirst = true } = opts;

  // Drop the canned welcome (always index 0) and anything with no content —
  // an empty bot message is the placeholder a stream writes into.
  const body = (skipFirst ? messages.slice(1) : messages).filter(
    (m) => m.content.trim().length > 0,
  );

  const header = [`# Chat with RAG — ${SITE}`, ""];
  const stamp = formatTimestamp(exportedAt);
  if (stamp) header.push(`_Exported ${stamp}_`, "");

  if (body.length === 0) {
    return [...header, "_No messages in this conversation._", ""].join("\n");
  }

  const lines: string[] = [...header, "---", ""];

  for (const m of body) {
    if (m.role === "user") {
      lines.push(`**You:** ${m.content.trim()}`, "");
      continue;
    }

    // A notice (error / rate limit) is labelled so the transcript doesn't read
    // as though the bot answered the question.
    lines.push(m.isNotice ? `**RAG** _(notice)_**:** ${m.content.trim()}` : `**RAG:** ${m.content.trim()}`, "");

    const s = (m.suggestions ?? []).filter((x) => x.trim().length > 0);
    if (s.length > 0) {
      lines.push(`_Suggested follow-ups: ${s.map((x) => `"${x.trim()}"`).join(" · ")}_`, "");
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
