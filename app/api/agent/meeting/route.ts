import { after } from "next/server";
import { sendMeetingRequest } from "@/lib/agent/meeting";
import { identifyFromRequest } from "@/lib/track/store";
import { clientKey } from "@/lib/rate-limit";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** POST: sends a meeting request the visitor just confirmed on the agent's card. Validation and the
 *  3/hr rate limit live in sendMeetingRequest; this only unpacks the body and maps the result to a status. */
export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try {
    b = await req.json();
    if (!b || typeof b !== "object") throw new Error("not an object");
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const r = await sendMeetingRequest({
    name: str(b.name) ?? "", email: str(b.email) ?? "", company: str(b.company), role: str(b.role), timeZone: str(b.timeZone), notes: str(b.notes),
    times: Array.isArray(b.times) ? b.times.filter((t): t is string => typeof t === "string") : [],
    sessionId: str(b.sessionId) ?? "",
    key: clientKey(req),
  });
  if (r.ok) {
    // Attach this visitor's whole browsing history to the person who just asked for a meeting.
    after(() => identifyFromRequest(req, { email: str(b.email) ?? "", name: str(b.name), company: str(b.company) }));
    return Response.json({ ok: true });
  }
  return Response.json({ ok: false, error: r.error }, { status: r.retryAfter ? 429 : 400, ...(r.retryAfter ? { headers: { "Retry-After": String(r.retryAfter) } } : {}) });
}
