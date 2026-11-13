"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_AUDIO_MS } from "@/lib/voice";

export type VoiceState = "idle" | "listening" | "transcribing" | "error";

const MIN_MS = 400; // shorter than this is a tap, not speech
const TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
// hands-free (voice mode): a level above SPEECH counts as talking; SILENCE_MS of quiet after talking ends the turn,
// and WAIT_MS with no talking at all gives up quietly
const SPEECH = 0.12, SILENCE_MS = 1300, WAIT_MS = 8000;

/** Push-to-talk recording: start() on press, stop() on release; start(true) is hands-free and stops itself once
 *  the speaker goes quiet. The recording is POSTed to /api/transcribe
 *  and the text handed to `onTranscript`. The mic level drives a `--lvl` (0..1) CSS var on `meterRef`
 *  (no React state per frame); it is skipped entirely under prefers-reduced-motion. */
export function useVoice(onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [message, setMessage] = useState("");
  const meterRef = useRef<HTMLElement | null>(null);
  const cb = useRef(onTranscript);
  useEffect(() => { cb.current = onTranscript; });

  const rec = useRef<{ mr: MediaRecorder; t0: number; cancelled: boolean } | null>(null);
  const want = useRef(false); // true between press and release, so a release during the permission prompt still cancels
  const ctl = useRef<AbortController | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Shows a message and returns to idle after a moment. */
  const fail = useCallback((msg: string) => {
    setState("error"); setMessage(msg);
    clearTimeout(clear.current);
    clear.current = setTimeout(() => { setState("idle"); setMessage(""); }, 4000);
  }, []);

  const transcribe = useCallback(async (blob: Blob, ms: number) => {
    setState("transcribing"); setMessage("Transcribing…");
    ctl.current = new AbortController();
    try {
      const body = new FormData();
      body.set("audio", blob, "voice");
      body.set("ms", String(ms));
      const res = await fetch("/api/transcribe", { method: "POST", body, signal: ctl.current.signal });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok) return fail(data.error ?? "Voice failed.");
      if (!data.text) return fail("Didn't catch that.");
      setState("idle"); setMessage("");
      cb.current(data.text);
    } catch (e) {
      if ((e as Error).name === "AbortError") { setState("idle"); setMessage(""); } else fail("Voice failed.");
    }
  }, [fail]);

  /** Ends the recording; `cancel` discards it instead of transcribing. Also aborts an in-flight transcription. */
  const stop = useCallback((cancel = false) => {
    want.current = false;
    if (ctl.current && !rec.current) { ctl.current.abort(); return; }
    const r = rec.current;
    if (!r) return;
    r.cancelled = cancel;
    if (r.mr.state !== "inactive") r.mr.stop();
  }, []);

  const start = useCallback(async (auto = false) => {
    if (rec.current || want.current) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return fail("Voice isn't supported here.");
    want.current = true;
    setState("listening"); setMessage("Starting mic…"); // the first getUserMedia can take a moment (permission prompt)
    clearTimeout(clear.current);
    ctl.current?.abort();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      want.current = false;
      const denied = (e as Error).name === "NotAllowedError" || (e as Error).name === "SecurityError";
      return fail(denied ? "Microphone blocked. Allow it in your browser." : "No microphone found.");
    }
    if (!want.current) { stream.getTracks().forEach((t) => t.stop()); return fail("Hold to talk."); } // released before the mic was ready

    const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), audioBitsPerSecond: 32000 });
    const state = { mr, t0: Date.now(), cancelled: false };
    rec.current = state;
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

    // Level meter: RMS of the analyser, written straight to a CSS var; hands-free also reads it to hear the end of a turn.
    let raf = 0;
    let ac: AudioContext | undefined;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (auto || !still) {
      ac = new AudioContext();
      void ac.resume(); // created after an await, so Safari may start it suspended
      const an = ac.createAnalyser();
      an.fftSize = 256;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let heard = false, loudAt = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        const lvl = Math.min(1, Math.sqrt(sum / buf.length) * 4), now = Date.now();
        if (!still) meterRef.current?.style.setProperty("--lvl", lvl.toFixed(2));
        if (auto) {
          if (lvl > SPEECH) { heard = true; loudAt = now; }
          if (heard ? now - loudAt > SILENCE_MS : now - state.t0 > WAIT_MS) { stop(!heard); return; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    }

    const cap = setTimeout(() => stop(), MAX_AUDIO_MS); // hard 25 s ceiling
    mr.onstop = () => {
      clearTimeout(cap);
      cancelAnimationFrame(raf);
      ac?.close().catch(() => {});
      meterRef.current?.style.removeProperty("--lvl");
      stream.getTracks().forEach((t) => t.stop());
      rec.current = null;
      const ms = Date.now() - state.t0;
      if (state.cancelled) { setState("idle"); setMessage(""); return; }
      if (ms < MIN_MS) return fail("Hold to talk.");
      void transcribe(new Blob(chunks, { type: mr.mimeType }), Math.min(ms, MAX_AUDIO_MS));
    };
    mr.start();
    setMessage("Listening…");
  }, [fail, stop, transcribe]);

  // Leaving the page or unmounting must release the microphone.
  useEffect(() => () => { clearTimeout(clear.current); ctl.current?.abort(); if (rec.current) { rec.current.cancelled = true; rec.current.mr.stop(); } }, []);

  return { state, message, meterRef, start, stop };
}
