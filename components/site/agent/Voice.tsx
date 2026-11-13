"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Glyph";
import { RATE_MAX, RATE_MIN, STYLES, VOICES, type StyleId } from "@/lib/voice";
import { setSpeaker, setVoiceMode, setVoicePrefs, speak, stopSpeaking, useSpeaker } from "./speech";
import { useVoice } from "./useVoice";
import "./voice.css";

const STYLE_NAMES: Record<StyleId, string> = { natural: "Natural", upbeat: "Upbeat", radio: "Radio host", hush: "Hushed" };
const PREVIEW = "Hi, I'm RAG, Rithvik's agent. Ask me anything about his work.";

/** Mic (hold to talk; tap to start/stop on touch; hold Space in the empty prompt), voice mode (hands-free:
 *  listen, send, speak the reply, listen again), the speaker toggle and a picker for voice, style and speed.
 *  The only contract with the agent: `onTranscript(text)` (fill the prompt) and `onSend(text)` (voice mode) out,
 *  and speak()/stopSpeaking() in ./speech called by the agent when an answer completes / a new question starts. */
export default function Voice({ onTranscript, onSend }: { onTranscript: (text: string) => void; onSend: (text: string) => void }) {
  const sp = useSpeaker();
  const mode = useRef(sp.mode);
  useEffect(() => { mode.current = sp.mode; });
  const { state, message, meterRef, start, stop } = useVoice((t) => (mode.current ? onSend(t) : onTranscript(t)));
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLSpanElement>(null);
  const busy = state === "listening" || state === "transcribing";
  const live = useRef({ busy, speaking: sp.speaking, mode: sp.mode });
  const heldKey = useRef(false);
  useEffect(() => { live.current = { busy, speaking: sp.speaking, mode: sp.mode }; });

  // Voice mode: when a spoken reply finishes, listen again (hands-free turn-taking; the mic never hears the reply).
  const wasSpeaking = useRef(false);
  useEffect(() => {
    if (wasSpeaking.current && !sp.speaking && sp.mode && state === "idle") void start(true);
    wasSpeaking.current = sp.speaking;
  }, [sp.speaking, sp.mode, state, start]);

  // The picker closes on an outside press.
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!pop.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);

  /** Toggles voice mode; turning it on starts listening at once (this click is the gesture the mic needs). */
  const toggleMode = () => {
    if (sp.mode) { setVoiceMode(false); stop(true); return; }
    setVoiceMode(true); stopSpeaking(); void start(true);
  };

  // Space-hold in the empty prompt; Esc silences speech / cancels recording before the dock's own Esc handler sees it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (live.current.busy || live.current.speaking || live.current.mode)) {
        e.stopPropagation(); setVoiceMode(false); stopSpeaking(); stop(true); setOpen(false); return;
      }
      if (e.key !== " " || e.metaKey || e.ctrlKey || e.altKey) return;
      if (heldKey.current) { e.preventDefault(); return; } // swallow auto-repeat
      const t = e.target;
      if (t instanceof HTMLTextAreaElement && t.id === "agent-input" && t.value === "" && !e.repeat) {
        e.preventDefault(); heldKey.current = true; stopSpeaking(); void start();
      }
    };
    const release = () => { if (heldKey.current) { heldKey.current = false; stop(); } };
    const onKeyUp = (e: KeyboardEvent) => { if (e.key === " ") release(); };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", release);
    };
  }, [start, stop]);

  return (
    <>
      <span className="vo-status" role="status" aria-live="polite" data-state={state}>{message || (sp.mode ? (sp.speaking ? "Speaking…" : "Voice mode") : "")}</span>
      <button type="button" className="vo-btn vo-live" aria-pressed={sp.mode} onClick={toggleMode}
        aria-label="Voice mode" title={sp.mode ? "End voice mode (Esc)" : "Voice mode: talk and hear replies, hands-free"}>
        <Icon name="activity" />
      </button>
      <button type="button" className="vo-btn vo-mic" data-state={state} ref={(el) => { meterRef.current = el; }}
        aria-label={state === "listening" ? "Stop recording" : "Hold to talk"} title="Hold to talk (or hold Space in an empty prompt)"
        disabled={state === "transcribing"}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          stopSpeaking();
          if (e.pointerType === "touch") { if (state === "listening") stop(); else void start(); return; } // tap-to-toggle: holding a finger fights scrolling
          e.currentTarget.setPointerCapture(e.pointerId);
          void start();
        }}
        onPointerUp={(e) => { if (e.pointerType !== "touch") stop(); }}
        onPointerCancel={(e) => { if (e.pointerType !== "touch") stop(true); }}
        onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); stopSpeaking(); void start(); } }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); stop(); } }}>
        <svg className="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="9" y="2" width="6" height="13" rx="3" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><path d="M12 19v3" />
        </svg>
      </button>
      <button type="button" className="vo-btn vo-spk" aria-pressed={sp.on} data-speaking={sp.speaking}
        aria-label="Speak replies aloud" title={sp.speaking ? "Stop speaking" : sp.on ? "Spoken replies on" : "Spoken replies off"}
        onClick={() => setSpeaker(sp.speaking ? false : !sp.on)}>
        <Icon name="volume-2" />
      </button>
      <span className="vo-setw" ref={pop}>
        <button type="button" className="vo-btn vo-set" aria-expanded={open} aria-haspopup="dialog" aria-label="Voice settings" title="Voice, style and speed" onClick={() => setOpen((v) => !v)}>
          <svg className="ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
          </svg>
        </button>
        {open && (
          <span className="vo-pop" role="dialog" aria-label="Voice settings">
            <span className="vo-k">Voice</span>
            <span className="vo-chips" role="radiogroup" aria-label="Voice">
              {VOICES.map((v) => (
                <button key={v.id} type="button" role="radio" aria-checked={sp.voice === v.id} title={v.note} onClick={() => setVoicePrefs({ voice: v.id })}>{v.id}</button>
              ))}
            </span>
            <span className="vo-note">{VOICES.find((v) => v.id === sp.voice)?.note}</span>
            <span className="vo-k">Style</span>
            <span className="vo-chips" role="radiogroup" aria-label="Style">
              {(Object.keys(STYLES) as StyleId[]).map((s) => (
                <button key={s} type="button" role="radio" aria-checked={sp.style === s} onClick={() => setVoicePrefs({ style: s })}>{STYLE_NAMES[s]}</button>
              ))}
            </span>
            <label className="vo-k vo-rate">Speed <b>{sp.rate.toFixed(2)}x</b>
              <input type="range" min={RATE_MIN} max={RATE_MAX} step={0.05} value={sp.rate} onChange={(e) => setVoicePrefs({ rate: +e.target.value })} />
            </label>
            <button type="button" className="vo-try" onClick={() => (sp.speaking ? stopSpeaking() : void speak(PREVIEW, true))}>{sp.speaking ? "Stop" : "Preview"}</button>
          </span>
        )}
      </span>
    </>
  );
}
