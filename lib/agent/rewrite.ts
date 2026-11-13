/** History-aware query rewrite: turns a follow-up ("what stack did it use?") into a standalone
 *  question before HyDE, retrieval and action gating. Prompt + output cleanup are pure; the call
 *  itself lives in the route. */
import type { ChatMessage } from "../openai.ts";

const PROMPT = `You rewrite search queries. Rewrite the visitor's latest message so it makes sense without the conversation, by resolving pronouns and references ("it", "that project", "him") from the conversation. Keep the visitor's own words, intent and grammatical form: an instruction stays an instruction ("make a chart of his roles"), a question stays a question. Never answer it, never address the visitor, never turn it into a question back to them. If it is already standalone or off-topic, return it EXACTLY unchanged. Output only the rewritten message.`;

/** Messages for the rewrite call: the last few turns as plain text, then the latest message. */
export function rewriteMessages(history: { role: "user" | "assistant"; content: string }[], message: string): ChatMessage[] {
  const convo = history.map((m) => `${m.role === "user" ? "Visitor" : "Agent"}: ${m.content.slice(0, 600)}`).join("\n");
  return [
    { role: "system", content: PROMPT },
    { role: "user", content: `Conversation:\n${convo}\n\nLatest message: ${message}` },
  ];
}

/** One clean line, ≤300 chars, no label or wrapping quotes; the original when the output is empty. */
export function cleanRewrite(raw: string, fallback: string): string {
  const s = raw
    .split("\n").map((l) => l.trim()).find(Boolean)
    ?.replace(/^(standalone question|question|rewritten)\s*:\s*/i, "")
    .replace(/^["'“]+|["'”]+$/g, "")
    .trim()
    .slice(0, 300);
  return s || fallback;
}
