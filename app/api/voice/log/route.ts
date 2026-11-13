import { clientKey, rateLimit } from "@/lib/rate-limit";
import { logTurn, startSession } from "@/lib/agent/log";
import type { TurnRow } from "@/lib/agent/obs";

const MAX = 4000; // characters per side of a spoken turn

/** POST { sessionId?, user, agent, tools? } -> { sessionId }: records one voice-mode turn in the conversation log, so the
 *  dashboard and share links include voice. Voice turns are transcribed in the browser, so unlike typed answers they are
 *  stored as reported, capped, and tagged model "voice" (share links label them). */
export async function POST(req: Request) {
  let b: { sessionId?: unknown; user?: unknown; agent?: unknown; tools?: unknown };
  try { b = (await req.json()) as typeof b; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const user = typeof b.user === "string" ? b.user.trim().slice(0, MAX) : "";
  const agent = typeof b.agent === "string" ? b.agent.trim().slice(0, MAX) : "";
  if (!user && !agent) return Response.json({ error: "Nothing to log." }, { status: 400 });
  const limited = await rateLimit("voice-log", clientKey(req), 120, 3000);
  if (!limited.ok) return Response.json({ error: "Too many requests." }, { status: limited.status });

  const sessionId = await startSession(req, typeof b.sessionId === "string" ? b.sessionId : null);
  const tools = (Array.isArray(b.tools) ? b.tools : []).slice(0, 8).flatMap((t): TurnRow[] => {
    const x = t as { name?: unknown; result?: unknown };
    return typeof x.name === "string" ? [{ role: "tool", content: x.name.slice(0, 64), tools: { name: x.name.slice(0, 64), result: String(x.result ?? "").slice(0, 300) } }] : [];
  });
  await logTurn(sessionId, [
    ...(user ? [{ role: "user" as const, content: user, model: "voice" }] : []),
    ...tools,
    ...(agent ? [{ role: "assistant" as const, content: agent, model: "voice" }] : []),
  ]);
  return Response.json({ sessionId }, { headers: { "Cache-Control": "no-store" } });
}
