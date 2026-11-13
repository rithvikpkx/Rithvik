import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getContent } from "@/lib/content";
import { allowedFor } from "@/lib/agent/allowed";
import { screenCalls } from "@/lib/agent/tools";
import { cleanTimeZone } from "@/lib/agent/context";
import { getPalettes } from "@/lib/designs/server";
import { isOwner } from "@/lib/track/owner";
import { rememberVisitor } from "@/lib/track/store";
import { visitorIdFromCookie } from "@/lib/track/schema";

const PER_KEY = 120; // tool calls per IP per hour (a voice conversation makes a handful)
const GLOBAL = 3000;
const SIDE_EFFECTS = new Set(["open_project", "show_section", "open_resume", "start_game", "switch_design", "draft_email", "open_recruiter_mode"]);

/** POST { name, arguments, timeZone? } -> { call, reply }: validates one voice-mode tool call through the same gate as
 *  /api/chat (names checked against published content, arguments rebuilt, calendar tools run here) and returns the
 *  validated call for the browser to carry out, plus the result text for the model. `call` is null when rejected. */
export async function POST(req: Request) {
  let body: { name?: unknown; arguments?: unknown; timeZone?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof body.name !== "string" || body.name.length > 64) return Response.json({ error: "Invalid request." }, { status: 400 });
  const args = typeof body.arguments === "string" ? body.arguments.slice(0, 40_000) : "{}";

  const limited = await rateLimit("live-tool", clientKey(req), PER_KEY, GLOBAL);
  if (!limited.ok) return Response.json({ call: null, reply: "Rejected: too many actions right now." }, { status: limited.status });

  const [content, palettes] = await Promise.all([getContent(), getPalettes()]);
  const visitorId = isOwner(req) ? null : visitorIdFromCookie(req.headers.get("cookie"));
  const { kept, replies } = await screenCalls([{ id: "live", name: body.name, arguments: args }], allowedFor(content, palettes), new Date(), cleanTimeZone(body.timeZone),
    visitorId ? { remember: (f) => rememberVisitor(visitorId, f) } : {});
  const call = kept[0] ?? null;
  // in voice mode the visitor asked out loud, so screen actions happen at once (a meeting request still waits for a click)
  const reply = call && SIDE_EFFECTS.has(call.name) ? "Done: it is on the visitor's screen now." : (replies[0]?.content ?? "Rejected.");
  return Response.json({ call, reply }, { headers: { "Cache-Control": "no-store" } });
}
