/**
 * Thin OpenAI chat-completions streaming client (fetch + SSE, no SDK).
 * Embeddings, HyDE, suggestions and captioning already call the REST API
 * directly; this covers the one streaming call, which used to go through
 * LangChain. Server-only (reads OPENAI_API_KEY).
 */

/** Pulls the text deltas out of every complete SSE event in `buffer` and
 *  returns the unconsumed tail (a partial event) for the next call. Pure so it
 *  can be unit-tested without a network. */
export function parseSSEDeltas(buffer: string): { deltas: string[]; rest: string } {
  const events = buffer.split(/\r?\n\r?\n/);
  const rest = events.pop() ?? ""; // last piece has no terminator yet
  const deltas: string[] = [];
  for (const event of events) {
    for (const line of event.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const text = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) deltas.push(text);
      } catch {
        // Malformed event: skip it rather than killing the whole answer.
      }
    }
  }
  return { deltas, rest };
}

/** Opens a streaming chat completion and returns an async iterable of text deltas.
 *  Rejects before returning if the request itself fails (bad key, 429, ...),
 *  so callers can still answer with an error status. `signal` aborts the
 *  upstream request, e.g. when the visitor closes the tab. */
export async function streamChat(opts: {
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature: number;
  maxTokens: number;
  signal?: AbortSignal;
}): Promise<AsyncGenerator<string>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.maxTokens,
      stream: true,
    }),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat completion failed (${res.status}): ${await res.text()}`);

  return deltasOf(res.body);
}

/** Decodes an SSE response body into text deltas; cancels the upstream read if
 *  the consumer stops early. */
async function* deltasOf(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const { deltas, rest } = parseSSEDeltas(buffer);
      buffer = rest;
      yield* deltas;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
