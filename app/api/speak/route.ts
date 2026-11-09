import { rateLimit, clientKey } from "@/lib/rate-limit";
import { MAX_SPEAK_CHARS, speakable } from "@/lib/voice";

const PER_KEY = 40;      // spoken replies per IP (IPv6: per /64) per hour
const GLOBAL = 800;      // all visitors per hour
const MODEL = process.env.VOICE_TTS_MODEL || "gpt-4o-mini-tts";

/** POST { text } -> streamed mp3. The text is cleaned of markdown/URLs/footnotes here (the server is the
 *  gate), rate-limited before the spend, and the audio is piped through without buffering. */
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Voice is not configured." }, { status: 503 });
  let text: unknown;
  try { text = ((await req.json()) as { text?: unknown }).text; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (typeof text !== "string" || !text.trim()) return Response.json({ error: "No text." }, { status: 400 });
  if (text.length > MAX_SPEAK_CHARS) return Response.json({ error: "Text is too long." }, { status: 413 });
  const input = speakable(text);
  if (!input) return Response.json({ error: "Nothing to speak." }, { status: 400 });

  const limited = await rateLimit("tts", clientKey(req), PER_KEY, GLOBAL);
  if (!limited.ok) {
    return Response.json({ error: limited.status === 429 ? "Too many voice requests. Try again later." : "Voice is unavailable right now." },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL, voice: "sage", input, response_format: "mp3",
        instructions: "Speak in a warm, concise, professional tone at a calm, natural pace.",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json({ error: "Speech timed out." }, { status: 504 });
  }
  if (!res.ok || !res.body) {
    console.error("[voice] speak failed:", res.status, (await res.text()).slice(0, 200));
    return Response.json({ error: "Speech failed." }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
