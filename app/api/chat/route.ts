import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import { adminClient } from "@/lib/supabase";

const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY! });

/** Embeds a query string using OpenAI text-embedding-3-small. */
async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });

  if (!res.ok) throw new Error(`Embedding failed: ${await res.text()}`);
  const json = await res.json() as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}

export async function POST(req: Request) {
  const { message } = await req.json() as { message: string };

  // Embed the user's question and retrieve the top 5 most relevant chunks
  const embedding = await embedQuery(message);
  const { data: chunks } = await adminClient().rpc("match_embeddings", {
    query_embedding: embedding,
    match_count: 5,
  });

  const context = (chunks as { content: string }[] ?? [])
    .map((c) => c.content)
    .join("\n\n");

  const system = `You are RAG (Rithvik Augmented Generation), an AI assistant that answers questions about Rithvik Praveen Kumar.
Answer only using the context below. If the answer isn't in the context, say you don't have that information.
Be concise, friendly, and accurate.

Context:
${context}`;

  const result = streamText({
    model: deepseek("deepseek-chat"),
    system,
    messages: [{ role: "user", content: message }],
    maxOutputTokens: 512,
  });

  return result.toTextStreamResponse();
}
