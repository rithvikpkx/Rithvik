import { useSyncExternalStore } from "react";
import { speakable } from "@/lib/voice";

/** Spoken replies as a tiny module-level store, so the agent's state machine can call `speak(answer)` /
 *  `stopSpeaking()` without any prop plumbing, and the speaker toggle can subscribe to the same state. */

const KEY = "rithvik-agent-speaker";
type Snap = { on: boolean; speaking: boolean };

const OFF: Snap = { on: false, speaking: false };
const subs = new Set<() => void>();
let snap: Snap = { on: false, speaking: false };
let loaded = false;
let audio: HTMLAudioElement | null = null;
let ctl: AbortController | null = null;
let url: string | null = null;
let gen = 0; // bumps on every start/stop so a slow fetch can't play over a newer request

const set = (next: Partial<Snap>) => { snap = { ...snap, ...next }; subs.forEach((f) => f()); };

/** Reads the persisted toggle once, on the first client use (storage can throw in private windows). */
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { snap = { ...snap, on: localStorage.getItem(KEY) === "1" }; } catch { /* default off */ }
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

/** Turns spoken replies on or off (persisted); turning off also silences whatever is playing. */
export function setSpeaker(on: boolean) {
  load();
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* not persisted */ }
  if (!on) stopSpeaking();
  set({ on });
}

/** Speaks a completed answer when the speaker is on. Replaces any current utterance; failures are silent
 *  (voice is a bonus, never an error in the transcript). */
export async function speak(text: string) {
  load();
  stopSpeaking();
  // Without a prior gesture the browser would block playback anyway; don't spend a TTS call on it.
  if (!snap.on || navigator.userActivation?.hasBeenActive === false) return;
  const input = speakable(text);
  if (!input) return;
  const mine = ++gen;
  ctl = new AbortController();
  set({ speaking: true });
  try {
    const res = await fetch("/api/speak", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }), signal: ctl.signal,
    });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob(); // a few KB of mp3; simpler than MediaSource streaming
    if (mine !== gen) return;
    url = URL.createObjectURL(blob);
    audio = new Audio(url);
    audio.onended = stopSpeaking;
    await audio.play();
  } catch {
    if (mine === gen) stopSpeaking();
  }
}

/** Speaker toggle state for the UI: `on` (persisted preference) and `speaking` (audio is in flight/playing). */
export function useSpeaker(): Snap {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => { load(); return snap; },
    () => OFF,
  );
}
