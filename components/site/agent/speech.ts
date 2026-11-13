import { useSyncExternalStore } from "react";
import { clampRate, pickStyle, pickVoice, speakable, type StyleId } from "@/lib/voice";

/** Spoken replies as a tiny module-level store, so the agent's state machine can call `speak(answer)` /
 *  `stopSpeaking()` without any prop plumbing, and the voice controls can subscribe to the same state.
 *  `mode` is the hands-free conversation (listen -> send -> speak -> listen); voice, style and rate are the
 *  visitor's picks, persisted per browser. */

const KEY = "rithvik-agent-speaker";
const PREFS = "rithvik-agent-voice";
export type Snap = { on: boolean; speaking: boolean; mode: boolean; voice: string; style: StyleId; rate: number };

const OFF: Snap = { on: false, speaking: false, mode: false, voice: "sage", style: "natural", rate: 1 };
const subs = new Set<() => void>();
let snap: Snap = OFF;
let loaded = false;
let audio: HTMLAudioElement | null = null;
let ctl: AbortController | null = null;
let url: string | null = null;
let gen = 0; // bumps on every start/stop so a slow fetch can't play over a newer request

const set = (next: Partial<Snap>) => { snap = { ...snap, ...next }; subs.forEach((f) => f()); };

/** Reads the persisted toggle and picks once, on the first client use (storage can throw in private windows). */
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const p = JSON.parse(localStorage.getItem(PREFS) || "{}") as Partial<Snap>;
    snap = { ...snap, on: localStorage.getItem(KEY) === "1", voice: pickVoice(p.voice), style: pickStyle(p.style), rate: clampRate(p.rate ?? 1) };
  } catch { /* defaults */ }
}

/** Halts playback and any in-flight /api/speak request. Safe to call anytime. */
export function stopSpeaking() {
  gen++;
  ctl?.abort();
  ctl = null;
  if (audio) { audio.pause(); audio.src = ""; audio = null; }
  if (url) { URL.revokeObjectURL(url); url = null; }
  if (snap.speaking) set({ speaking: false });
}

/** Turns spoken replies on or off (persisted); turning off also silences whatever is playing and ends voice mode. */
export function setSpeaker(on: boolean) {
  load();
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* not persisted */ }
  if (!on) stopSpeaking();
  set(on ? { on } : { on, mode: false });
}

/** Starts or ends the hands-free conversation; starting it also turns spoken replies on. */
export function setVoiceMode(mode: boolean) {
  load();
  if (mode && !snap.on) setSpeaker(true);
  if (!mode) stopSpeaking();
  set({ mode });
}

/** Updates the voice, style or speed (persisted). Speed also applies to a reply already playing. */
export function setVoicePrefs(p: Partial<Pick<Snap, "voice" | "style" | "rate">>) {
  load();
  set({ voice: pickVoice(p.voice ?? snap.voice), style: pickStyle(p.style ?? snap.style), rate: clampRate(p.rate ?? snap.rate) });
  if (audio) audio.playbackRate = snap.rate;
  try { localStorage.setItem(PREFS, JSON.stringify({ voice: snap.voice, style: snap.style, rate: snap.rate })); } catch { /* not persisted */ }
}

/** Speaks a completed answer when the speaker is on (`force` speaks regardless, for the picker's preview).
 *  Replaces any current utterance; failures are silent (voice is a bonus, never an error in the transcript). */
export async function speak(text: string, force = false) {
  load();
  stopSpeaking();
  // Without a prior gesture the browser would block playback anyway; don't spend a TTS call on it.
  if ((!snap.on && !force) || navigator.userActivation?.hasBeenActive === false) return;
  const input = speakable(text);
  if (!input) return;
  const mine = ++gen;
  ctl = new AbortController();
  set({ speaking: true });
  try {
    const res = await fetch("/api/speak", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, voice: snap.voice, style: snap.style }), signal: ctl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob(); // a few KB of mp3; simpler than MediaSource streaming
    if (mine !== gen) return;
    url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.playbackRate = snap.rate; // speed is applied here (pitch is preserved), so it costs no extra TTS call
    audio.onended = stopSpeaking;
    await audio.play();
  } catch {
    if (mine === gen) stopSpeaking();
  }
}

/** Voice state for the UI: the speaker toggle, whether audio is in flight/playing, voice mode and the picks. */
export function useSpeaker(): Snap {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => { load(); return snap; },
    () => OFF,
  );
}
