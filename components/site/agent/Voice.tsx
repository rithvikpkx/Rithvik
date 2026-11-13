"use client";
import { useEffect, useRef } from "react";
import { Icon } from "../Glyph";
import { setSpeaker, stopSpeaking, useSpeaker } from "./speech";
import { useVoice } from "./useVoice";
import "./voice.css";

/** Mic (hold to talk; tap to start/stop on touch; hold Space in the empty prompt) and speaker toggle for the
 *  agent bar. The only contract with the agent: `onTranscript(text)` out, and speak()/stopSpeaking() in
 *  ./speech called by the agent when an answer completes / a new question starts. */
export default function Voice({ onTranscript }: { onTranscript: (text: string) => void }) {
  const { state, message, meterRef, start, stop } = useVoice(onTranscript);
  const sp = useSpeaker();
  const busy = state === "listening" || state === "transcribing";
  const live = useRef({ busy, speaking: sp.speaking });
  const heldKey = useRef(false);
  useEffect(() => { live.current = { busy, speaking: sp.speaking }; });

  // Space-hold in the empty prompt; Esc silences speech / cancels recording before the dock's own Esc handler sees it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (live.current.busy || live.current.speaking)) {
        e.stopPropagation(); stopSpeaking(); stop(true); return;
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
      <span className="vo-status" role="status" aria-live="polite" data-state={state}>{message}</span>
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
    </>
  );
}
