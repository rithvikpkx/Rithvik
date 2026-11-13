/**
 * Thin OpenAI chat-completions client (fetch + SSE, no SDK). Handles both model
 * families: classic (gpt-4o*) and reasoning (gpt-5*, o*), which take
 * `max_completion_tokens`, reject `temperature`, and accept `reasoning_effort`.
 * Tool calls work in streaming and non-streaming modes. Server-only (reads
 * OPENAI_API_KEY); no "@/" imports so node:test can load it.
 */

/** Answer + tool-calling model. An eval picks the default; env overrides it. */
export const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-6-luna"; // picked by the eval (docs/plans/v4-overhaul.md): best tools + injection, cheapest
/** Cheap helper model: rewrite, HyDE, suggestions. */
export const AUX_MODEL = process.env.AUX_MODEL || "gpt-5-nano";

export type Role = "system" | "user" | "assistant" | "tool";
export type ToolCall = { id: string; name: string; arguments: string };
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type ChatOpts = {
  model: string;
  messages: ChatMessage[];
  temperature?: number; // dropped for reasoning models
  maxTokens: number;
  reasoningEffort?: "none" | "minimal" | "low"; // reasoning models only; keeps time-to-first-token low
  tools?: ToolDef[];
  json?: boolean; // response_format json_object
  noTools?: boolean; // tool_choice "none": the tools stay (same cached prefix) but this completion must answer
  cacheKey?: string; // prompt_cache_key: requests sharing a long fixed prefix land on the same cache
  signal?: AbortSignal;
};

/** gpt-5 and later families and the o-series are reasoning models. */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-([5-9]|\d{2,})|o\d)/.test(model);
}

/** Builds the request body for either model family. Pure, so the per-family rules are tested. */
export function chatBody(o: ChatOpts, stream: boolean): Record<string, unknown> {
  const reasoning = isReasoningModel(o.model);
  return {
    model: o.model,
    messages: o.messages,
    ...(reasoning
      ? { max_completion_tokens: o.maxTokens, ...(o.reasoningEffort ? { reasoning_effort: o.reasoningEffort } : {}) }
      : { max_tokens: o.maxTokens, ...(o.temperature !== undefined ? { temperature: o.temperature } : {}) }),
    ...(o.tools?.length ? { tools: o.tools, ...(o.noTools ? { tool_choice: "none" } : {}) } : {}),
    ...(o.json ? { response_format: { type: "json_object" } } : {}),
    ...(o.cacheKey ? { prompt_cache_key: o.cacheKey } : {}),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}), // usage arrives in a final chunk
  };
}

/** Partial tool-call fragment from one SSE delta. */
export type ToolDelta = { index: number; id?: string; name?: string; args?: string };

/** Pulls text and tool-call fragments out of every complete SSE event in `buffer`
 *  and returns the unconsumed tail (a partial event) for the next call. Pure. */
export function parseSSEDeltas(buffer: string): { deltas: string[]; tools: ToolDelta[]; usage: number; rest: string } {
  const events = buffer.split(/\r?\n\r?\n/);
  const rest = events.pop() ?? ""; // last piece has no terminator yet
  const deltas: string[] = [];
  const tools: ToolDelta[] = [];
  let usage = 0;
  for (const event of events) {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        if (typeof json?.usage?.total_tokens === "number") usage += json.usage.total_tokens;
        const delta = json?.choices?.[0]?.delta;
        if (typeof delta?.content === "string" && delta.content) deltas.push(delta.content);
        for (const t of Array.isArray(delta?.tool_calls) ? delta.tool_calls : []) {
          tools.push({ index: Number(t.index) || 0, id: t.id, name: t.function?.name, args: t.function?.arguments });
        }
      } catch {
        // Malformed event: skip it rather than killing the whole answer.
      }
    }
  }
  return { deltas, tools, usage, rest };
}

/** Folds streamed tool-call fragments (keyed by index) into whole calls. Pure. */
export function mergeToolDeltas(acc: ToolCall[], parts: ToolDelta[]): ToolCall[] {
  const out = [...acc];
  for (const p of parts) {
    const cur = out[p.index] ?? { id: "", name: "", arguments: "" };
    out[p.index] = { id: p.id || cur.id, name: cur.name + (p.name ?? ""), arguments: cur.arguments + (p.args ?? "") };
  }
  return out.filter(Boolean);
}

/** POSTs a completion request; throws with the API's message on failure. */
async function post(o: ChatOpts, stream: boolean): Promise<Response> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(chatBody(o, stream)),
    signal: o.signal,
  });
  if (res.status === 400 && o.reasoningEffort && o.reasoningEffort !== "none") {
    // Newer models (gpt-5.4+, gpt-6) reject a reasoning effort alongside function tools on this endpoint and
    // ask for "none"; older gpt-5 models reject "none". Retry once instead of tracking per-model rules.
    const text = await res.text();
    if (text.includes("reasoning_effort")) return post({ ...o, reasoningEffort: "none" }, stream);
    throw new Error(`Chat completion failed (400): ${text}`);
  }
  if (!res.ok || (stream && !res.body)) throw new Error(`Chat completion failed (${res.status}): ${await res.text()}`);
  return res;
}

/** One non-streaming completion: the text plus any tool calls. */
export async function complete(o: ChatOpts): Promise<{ content: string; toolCalls: ToolCall[] }> {
  const json = (await (await post(o, false)).json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[];
  };
  const m = json.choices?.[0]?.message;
  return {
    content: m?.content ?? "",
    toolCalls: (m?.tool_calls ?? []).map((t) => ({ id: t.id, name: t.function.name, arguments: t.function.arguments })),
  };
}

export type StreamEvent = { text: string } | { toolCalls: ToolCall[] } | { usage: number };

/** Opens a streaming completion: yields `{text}` deltas, then one `{toolCalls}` at the end if the
 *  model called tools, then `{usage}` (total tokens). Rejects before returning if the request itself fails (bad key, 429, ...),
 *  so callers can still answer with an error status. `signal` aborts the upstream request. */
export async function streamChat(o: ChatOpts): Promise<AsyncGenerator<StreamEvent>> {
  return eventsOf((await post(o, true)).body!);
}

/** Decodes an SSE body into events; cancels the upstream read if the consumer stops early. */
async function* eventsOf(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let calls: ToolCall[] = [];
  let usage = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { deltas, tools, usage: u, rest } = parseSSEDeltas(buffer);
      buffer = rest;
      usage += u;
      calls = mergeToolDeltas(calls, tools);
      for (const text of deltas) yield { text };
    }
    if (calls.length) yield { toolCalls: calls };
    if (usage) yield { usage };
  } finally {
    reader.cancel().catch(() => {});
  }
}
