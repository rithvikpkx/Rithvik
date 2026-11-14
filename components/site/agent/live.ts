import { useSyncExternalStore } from "react";
import { adminHeaders } from "@/lib/admin-tab";

/** Voice mode: one live voice session over WebRTC (mic up, voice down, events on the "oai-events" data channel), as a
 *  module-level store like ./speech. /api/voice/live trades the browser's offer for OpenAI's answer, so the key never
 *  reaches the page. Transcripts go to the handler the agent registers; levels feed the orb. Sessions are billed by
 *  the minute, so one ends itself after MAX_MS, or IDLE_MS with nobody talking. */

export type Phase = "off" | "connecting" | "ready" | "listening" | "thinking" | "speaking" | "error";
export type LiveSnap = { phase: Phase; message: string; muted?: boolean };
export type LiveHandlers = {
  transcript: (who: "user" | "agent", delta: string) => void;
  turnEnd: () => void;
  /** Runs one tool call on the page (validated by the server first) and resolves to the result text for the model. */
  tool: (name: string, args: string) => Promise<string>;
  /** The conversation so far as plain text, so a new session (or one resumed after a page load) continues it. */
  history?: () => string;
  /** Called once a start attempt settles, so the status bar can show the voice window. */
  refreshUsage?: () => void;
};
export type LivePrefs = { voice: string; style: string; rate: number; history?: string };
/** sessionStorage flag: voice mode was on when the page navigated (recruiter mode), so the next page resumes it. */
export const RESUME_KEY = "rithvik-live-resume";

const MAX_MS = 10 * 60_000;
const IDLE_MS = 2 * 60_000;
const OFF: LiveSnap = { phase: "off", message: "" };
const subs = new Set<() => void>();
let snap: LiveSnap = OFF;
let s: {
  pc: RTCPeerConnection; dc: RTCDataChannel; mic: MediaStream; audio: HTMLAudioElement; ac: AudioContext;
  inA: AnalyserNode; outA: AnalyserNode; timers: ReturnType<typeof setTimeout>[]; idle?: ReturnType<typeof setTimeout>;
  thinking: boolean; last: "user" | "agent" | null;
} | null = null;
let gen = 0; // a stop() during connecting makes the late connect bail

const set = (next: Partial<LiveSnap>) => { snap = { ...snap, ...next }; subs.forEach((f) => f()); };
const buf = new Uint8Array(256);
/** RMS level (0..1, boosted) of one analyser. */
function rms(a: AnalyserNode): number {
  a.getByteTimeDomainData(buf);
  let sum = 0;
  for (const v of buf) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / buf.length) * 4);
}

/** The live levels for the orb: the visitor's mic and the voice, plus the phase they imply. Cheap; call per frame. */
export function liveLevels(): { mic: number; out: number } {
  return s ? { mic: rms(s.inA), out: rms(s.outA) } : { mic: 0, out: 0 };
}

/** Restarts the "nobody is talking" countdown. */
function touch() {
  if (!s) return;
  clearTimeout(s.idle);
  s.idle = setTimeout(() => stopLive("Voice mode ended after a quiet stretch."), IDLE_MS);
}

type Item = { type?: string; call_id?: string; name?: string; arguments?: string };
type Inner = { type?: string; item?: Item };
const answered = new Set<string>(); // a call can surface in more than one event shape; answer it once

/** Runs a tool call from the backend and hands the result back so the voice can carry on. */
async function onCall(h: LiveHandlers, it: Item) {
  if (!it.call_id || !it.name || answered.has(it.call_id)) return;
  answered.add(it.call_id);
  if (s) s.thinking = true;
  let output: string;
  try { output = await h.tool(it.name, it.arguments ?? "{}"); } catch { output = "Rejected: the action failed."; }
  const dc = s?.dc;
  if (!dc || dc.readyState !== "open") return;
  dc.send(JSON.stringify({ type: "response.item.create", item: { type: "function_call_output", call_id: it.call_id, output } }));
  dc.send(JSON.stringify({ type: "response.create" }));
}

/** One event from the data channel. Payload fields are read defensively. */
function onEvent(h: LiveHandlers, raw: string) {
  let e: { type?: string; delta?: string; text?: string; transcript?: string; event?: Inner; response_event?: Inner; data?: Inner; item?: Item; error?: { message?: string } };
  try { e = JSON.parse(raw); } catch { return; }
  const text = e.delta ?? e.text ?? e.transcript ?? "";
  switch (e.type) {
    case "session.started": set({ phase: "ready", message: "" }); touch(); break;
    case "session.input_transcript.delta":
      if (s) { if (s.last === "agent") h.turnEnd(); s.last = "user"; s.thinking = true; }
      if (text) h.transcript("user", text);
      touch();
      break;
    case "session.output_transcript.delta":
      if (s) { s.last = "agent"; s.thinking = false; }
      if (text) h.transcript("agent", text);
      touch();
      break;
    case "response.event": { // the backend at work; a finished function call is ours to run
      if (s) s.thinking = true;
      const inner = e.event ?? e.response_event ?? e.data;
      if (inner?.type === "response.output_item.done" && inner.item?.type === "function_call") void onCall(h, inner.item);
      break;
    }
    case "response.output_item.done": if (e.item?.type === "function_call") void onCall(h, e.item); break;
    case "session.closed": stopLive(); break;
    case "error": case "session.error": console.warn("[live]", e.error?.message ?? raw.slice(0, 200)); break;
  }
}

/** The phase right now, from levels and events: talking wins, then the voice, then a pending answer. */
export function livePhase(): Phase {
  if (!s || snap.phase === "connecting" || snap.phase === "off" || snap.phase === "error") return snap.phase;
  const { mic, out } = liveLevels();
  return out > 0.04 ? "speaking" : mic > 0.12 ? "listening" : s.thinking ? "thinking" : "ready";
}

/** Starts a voice session (call from a click: it asks for the mic). Resolves once connected or failed. */
export async function startLive(h: LiveHandlers, prefs: LivePrefs) {
  if (s || snap.phase === "connecting") return;
  const mine = ++gen;
  set({ phase: "connecting", message: "Connecting…" });
  let mic: MediaStream | undefined, pc: RTCPeerConnection | undefined;
  try {
    mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    pc = new RTCPeerConnection();
    const audio = new Audio();
    audio.autoplay = true;
    const ac = new AudioContext();
    void ac.resume();
    const inA = ac.createAnalyser(), outA = ac.createAnalyser();
    inA.fftSize = outA.fftSize = 256;
    ac.createMediaStreamSource(mic).connect(inA);
    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      audio.srcObject = stream;
      // after a page load (resumed session) the browser may block sound until a tap: say so, and the orb unmutes
      audio.play().catch(() => set({ muted: true }));
      ac.createMediaStreamSource(stream).connect(outA); // listen only; playback stays on the <audio> element
    };
    mic.getAudioTracks().forEach((t) => pc!.addTrack(t, mic!));
    const dc = pc.createDataChannel("oai-events");
    await pc.setLocalDescription(await pc.createOffer());
    // the endpoint wants the full offer, so wait for ICE gathering (bounded)
    await new Promise<void>((done) => {
      if (pc!.iceGatheringState === "complete") return done();
      const t = setTimeout(done, 4000);
      pc!.addEventListener("icegatheringstatechange", () => { if (pc!.iceGatheringState === "complete") { clearTimeout(t); done(); } });
    });
    const res = await fetch("/api/voice/live", { method: "POST", headers: { "Content-Type": "application/json", ...adminHeaders() }, body: JSON.stringify({ sdp: pc.localDescription?.sdp, ...prefs }) });
    const data = (await res.json().catch(() => ({}))) as { sdp?: string; error?: string };
    if (!res.ok || !data.sdp) throw new Error(data.error ?? "Voice mode could not start.");
    if (mine !== gen) throw new Error("");
    await pc.setRemoteDescription({ type: "answer", sdp: data.sdp });
    s = { pc, dc, mic, audio, ac, inA, outA, timers: [setTimeout(() => stopLive("Voice mode ended after 10 minutes."), MAX_MS)], thinking: false, last: null };
    dc.onmessage = (m) => onEvent(h, String(m.data));
    pc.onconnectionstatechange = () => { if (pc?.connectionState === "failed" || pc?.connectionState === "disconnected") stopLive("Voice mode disconnected."); };
    set({ phase: "ready", message: "" });
    touch();
  } catch (err) {
    mic?.getTracks().forEach((t) => t.stop());
    pc?.close();
    if (mine !== gen) return;
    const denied = (err as Error).name === "NotAllowedError";
    set({ phase: "error", message: denied ? "Microphone blocked. Allow it in your browser." : (err as Error).message || "Voice mode could not start." });
    setTimeout(() => { if (snap.phase === "error") set(OFF); }, 5000);
  }
}

/** Ends the session and releases the mic; `message` explains why when it ended by itself. */
export function stopLive(message = "") {
  gen++;
  const x = s;
  s = null;
  if (x) {
    try { if (x.dc.readyState === "open") x.dc.send(JSON.stringify({ type: "session.close" })); } catch { /* closing anyway */ }
    x.timers.forEach(clearTimeout); clearTimeout(x.idle);
    x.mic.getTracks().forEach((t) => t.stop());
    x.audio.srcObject = null;
    void x.ac.close().catch(() => {});
    setTimeout(() => x.pc.close(), 300); // give session.close a moment to leave
  }
  set({ phase: "off", message, muted: false });
  if (message) setTimeout(() => { if (snap.phase === "off") set({ message: "" }); }, 5000);
}

/** True while a session is connecting or live. */
export const liveActive = () => !!s || snap.phase === "connecting";

/** Resolves once the voice has been quiet for a moment (or after 8 s), e.g. before navigating away mid-answer. */
export async function liveQuiet() {
  let quiet = 0;
  for (let t = 0; t < 8000 && quiet < 700; t += 100) { await new Promise((r) => setTimeout(r, 100)); quiet = livePhase() === "speaking" ? 0 : quiet + 100; }
}

/** Starts sound the browser held back (autoplay after a page load); call from a tap. */
export function unmuteLive() {
  if (!s) return;
  void s.audio.play().catch(() => {});
  void s.ac.resume().catch(() => {});
  set({ muted: false });
}

/** Voice-mode state for the UI. */
export function useLive(): LiveSnap {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snap, () => OFF);
}
