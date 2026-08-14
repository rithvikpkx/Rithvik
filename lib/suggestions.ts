/**
 * Generates grounded follow-up questions for the RAG chat. Server-only — the
 * wire format lives in lib/suggestion-protocol.ts so the client can parse the
 * stream without pulling any of this in.
 *
 * A failure here must never touch the answer stream: every path returns an
 * array, never throws.
 */
import {
  normalizeSuggestions,
  MAX_SUGGESTION_CHARS,
  WANTED_SUGGESTIONS,
} from "@/lib/suggestion-protocol";

export { SUGGESTIONS_SENTINEL } from "@/lib/suggestion-protocol";

const MODEL = "gpt-4o-mini";
const MAX_TOKENS = 160;

const SYSTEM_PROMPT = `You generate follow-up questions a VISITOR might ask next on Rithvik Praveen Kumar's portfolio chatbot.

Rules:
- Propose exactly ${WANTED_SUGGESTIONS} questions.
- Each MUST be answerable from the Context provided. Never propose a question the Context cannot answer — a suggestion that leads to "I don't have that detail" is worse than no suggestion.
- Write them in the visitor's voice, about Rithvik in the third person ("What did Rithvik...", "How does he...").
- Each must be at most ${MAX_SUGGESTION_CHARS} characters. Short and natural.
- Go BEYOND what a direct answer to the current question would already cover. Never restate the current question.
- No numbering, no surrounding quotes, no commentary.

Respond with JSON: {"suggestions": ["...", "...", "..."]}`;

/**
 * Asks for follow-ups grounded in the same context the answer is drawn from.
 * Start this in PARALLEL with the main completion and await it once the answer
 * has streamed — at 160 max tokens it lands well before the answer does, so it
 * adds no perceptible latency.
 *
 * Returns [] on any failure (missing key, non-2xx, malformed JSON). Callers
 * treat an empty array as "just don't show suggestions".
 */
export async function generateSuggestions(
  question: string,
  contextBlock: string,
): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) return [];
  if (!contextBlock.trim()) return [];   // nothing grounded to suggest from

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        // A little variety so a repeat visitor doesn't see identical chips.
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Current question: ${question}\n\nContext:\n${contextBlock}` },
        ],
      }),
    });
    if (!res.ok) {
      console.warn(`[rag] suggestions failed (${res.status}); continuing without them`);
      return [];
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content) as { suggestions?: unknown };
    return normalizeSuggestions(parsed.suggestions);
  } catch (e) {
    console.warn("[rag] suggestions threw; continuing without them:", e instanceof Error ? e.message : e);
    return [];
  }
}
