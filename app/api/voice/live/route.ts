import { clientKey, rateLimit } from "@/lib/rate-limit";
import { getContent } from "@/lib/content";
import { renderProfile, scrubPrivate } from "@/lib/agent/profile";
import { LIVE_INSTRUCTIONS, liveBackendInstructions } from "@/lib/agent/live-prompt";
import { CHAT_MODEL } from "@/lib/openai";

const PER_KEY = 6;      // voice sessions per IP (IPv6: per /64) per hour: each is billed by the minute
const GLOBAL = 120;     // all visitors per hour
const MAX_SDP = 20_000; // a browser offer is ~3-6 KB
const BACKEND = process.env.VOICE_LIVE_BACKEND_MODEL || CHAT_MODEL;

/** POST { sdp } -> { sdp }: starts a GPT-Live voice session for the browser's WebRTC offer and returns OpenAI's answer.
 *  The API key stays here; the grounding (the published profile) rides in the backend model's instructions. */
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Voice is not configured." }, { status: 503 });
  let sdp: unknown;
  try { ({ sdp } = (await req.json()) as { sdp?: unknown }); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof sdp !== "string" || !sdp.startsWith("v=0") || sdp.length > MAX_SDP) return Response.json({ error: "Invalid offer." }, { status: 400 });

  const limited = await rateLimit("live", clientKey(req), PER_KEY, GLOBAL);
  if (!limited.ok) {
    return Response.json({ error: limited.status === 429 ? "Voice mode limit reached. Try again later." : "Voice is unavailable right now." },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const profile = scrubPrivate(renderProfile(await getContent()));
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          model: "gpt-live-1",
          instructions: LIVE_INSTRUCTIONS,
          delegation: { type: "responses", responses: { model: BACKEND, instructions: liveBackendInstructions(profile) } },
        },
        transport: { type: "webrtc", sdp },
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return Response.json({ error: "Voice mode timed out." }, { status: 504 });
  }
  const data = (await res.json().catch(() => ({}))) as { transport?: { sdp?: string }; error?: { message?: string } };
  if (!res.ok || !data.transport?.sdp) {
    console.error("[voice] live session failed:", res.status, data.error?.message?.slice(0, 200));
    return Response.json({ error: "Voice mode could not start." }, { status: 502 });
  }
  return Response.json({ sdp: data.transport.sdp }, { headers: { "Cache-Control": "no-store" } });
}
