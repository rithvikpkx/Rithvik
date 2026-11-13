import { agentLimit } from "@/lib/agent-limit";
import { clientKey } from "@/lib/rate-limit";
import { durationOk, MAX_AUDIO_BYTES, sniffAudio, stripPromptEcho } from "@/lib/voice";

const PER_KEY = 30;      // transcriptions per IP (IPv6: per /64) per hour
const GLOBAL = 300;      // all visitors per hour
const MODEL = process.env.VOICE_STT_MODEL || "gpt-4o-transcribe";
// Biases spelling of the proper nouns visitors will actually say.
const PROMPT = "Rithvik Praveen Kumar, Purdue, BoilerFrame, OpenBCI, TinyML";
const MIME = { webm: "audio/webm", ogg: "audio/ogg", mp4: "audio/mp4", wav: "audio/wav" } as const;

/** POST multipart { audio, ms? } -> { text }. Cheap checks first, then the rate limit (recorded before the
 *  spend), then the OpenAI call; every refusal is a distinct status the client can word. */
export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return Response.json({ error: "Voice is not configured." }, { status: 503 });
  const len = Number(req.headers.get("content-length"));
  if (len > MAX_AUDIO_BYTES + 4096) return Response.json({ error: "Recording is too large." }, { status: 413 });

  const limited = await agentLimit(req, "voice", clientKey(req), PER_KEY, GLOBAL);
  if (!limited.ok) {
    return Response.json({ error: limited.status === 429 ? "Too many voice requests. Try again later." : "Voice is unavailable right now." },
      { status: limited.status, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) return Response.json({ error: "No audio." }, { status: 400 });
  if (file.size > MAX_AUDIO_BYTES) return Response.json({ error: "Recording is too large." }, { status: 413 });
  // Claimed length is advisory (the size cap is the real bound), but a lie is still a bad request.
  const ms = form.get("ms");
  if (ms !== null && !durationOk(Number(ms))) return Response.json({ error: "Recording is too long." }, { status: 413 });

  const kind = sniffAudio(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  if (!kind) return Response.json({ error: "Unsupported audio format." }, { status: 415 });

  const up = new FormData();
  up.set("model", MODEL);
  up.set("prompt", PROMPT);
  up.set("file", new Blob([file], { type: MIME[kind] }), `audio.${kind}`);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: up,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return Response.json({ error: "Transcription timed out." }, { status: 504 });
  }
  if (!res.ok) {
    console.error("[voice] transcribe failed:", res.status, (await res.text()).slice(0, 200));
    return Response.json({ error: "Transcription failed." }, { status: 502 });
  }
  const text = stripPromptEcho(String(((await res.json()) as { text?: string }).text ?? "").trim(), PROMPT).slice(0, 500);
  return Response.json({ text });
}
