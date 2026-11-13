"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../Glyph";
import { RATE_MAX, RATE_MIN, STYLES, VOICES, type StyleId } from "@/lib/voice";
import { setSpeaker, setVoicePrefs, speak, stopSpeaking, useSpeaker } from "./speech";
import { liveLevels, livePhase, startLive, stopLive, useLive, type LiveHandlers, type Phase } from "./live";
import { useVoice } from "./useVoice";
import "./voice.css";

const STYLE_NAMES: Record<StyleId, string> = { natural: "Natural", upbeat: "Upbeat", calm: "Calm" };
const PREVIEW = "Hi, I'm RAG, Rithvik's agent. Ask me anything about his work.";
const PHASE_TEXT: Record<Phase, string> = { off: "", connecting: "Connecting…", ready: "Go ahead, I'm listening", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…", error: "" };

/** Voice controls for the agent bar. One voice system: the visitor's voice, style and speed picks drive both modes.
 *  - voice mode: a live, full-duplex conversation (./live) that can use the site's tools, transcripts flowing into the
 *    log through `live`, with a reactive orb (it swells with the visitor's voice and the agent's, swirls while thinking);
 *  - the mic: hold-to-talk dictation into the prompt (tap on touch; hold Space in the empty prompt);
 *  - the speaker: read typed answers aloud, with a picker for voice, style and speed. */
export default function Voice({ onTranscript, live }: { onTranscript: (text: string) => void; live: LiveHandlers }) {
  const { state, message, meterRef, start, stop } = useVoice(onTranscript);
  const sp = useSpeaker();
  const lv = useLive();
  const on = lv.phase !== "off" && lv.phase !== "error";
  const [open, setOpen] = useState(false);
  const pop = useRef<HTMLSpanElement>(null);
  const orb = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  const handlers = useRef(live);
  useEffect(() => { handlers.current = live; });
  const busy = state === "listening" || state === "transcribing";
  const keys = useRef({ busy, speaking: sp.speaking, on });
  const heldKey = useRef(false);
  useEffect(() => { keys.current = { busy, speaking: sp.speaking, on }; });

  // The orb's frame loop: levels -> --lvl / --out on the bar (the bar's glow and the orb both read them), phase -> data-phase.
  useEffect(() => {
    if (!on) return;
    const bar = orb.current?.closest<HTMLElement>(".agent-bar");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, mic = 0, out = 0, last: Phase | "" = "";
    const tick = () => {
      const l = liveLevels(), ph = livePhase();
      mic += (l.mic - mic) * 0.35; out += (l.out - out) * 0.35; // smoothed, so the orb breathes instead of flickering
      if (!still && bar) { bar.style.setProperty("--lvl", mic.toFixed(3)); bar.style.setProperty("--out", out.toFixed(3)); }
      if (ph !== last) {
        last = ph;
        bar?.setAttribute("data-live", ph);
        if (label.current) label.current.textContent = PHASE_TEXT[ph];
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); bar?.removeAttribute("data-live"); bar?.style.removeProperty("--lvl"); bar?.style.removeProperty("--out"); };
  }, [on]);

  // Leaving the page or closing the dock ends a session (it is billed by the minute).
  useEffect(() => () => stopLive(), []);

  // The picker closes on an outside press.
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!pop.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);

  /** Starts or ends voice mode (this click is the gesture the mic and audio need). */
  const toggleLive = () => {
    if (on) { stopLive(); handlers.current.turnEnd(); return; }
    stopSpeaking(); stop(true);
    void startLive(
      { transcript: (w, d) => handlers.current.transcript(w, d), turnEnd: () => handlers.current.turnEnd(), tool: (n, a) => handlers.current.tool(n, a) },
      { voice: sp.voice, style: sp.style, rate: sp.rate },
    );
  };

  // Space-hold in the empty prompt; Esc ends voice mode / silences speech / cancels recording before the dock's own Esc.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (keys.current.busy || keys.current.speaking || keys.current.on)) {
        e.stopPropagation(); stopSpeaking(); stop(true); setOpen(false);
        if (keys.current.on) { stopLive(); handlers.current.turnEnd(); }
        return;
      }
      if (e.key !== " " || e.metaKey || e.ctrlKey || e.altKey || keys.current.on) return;
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
      {on ? (
        <span className="vo-stage" aria-live="polite">
          <span className="vo-orb" ref={orb} aria-hidden="true"><i /><i /><i /></span>
          <span className="vo-eq" aria-hidden="true">{[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ ["--k" as string]: k }} />)}</span>
          <span className="vo-phase" ref={label}>{PHASE_TEXT[lv.phase]}</span>
        </span>
      ) : (
        <span className="vo-status" role="status" aria-live="polite" data-state={lv.message ? "error" : state}>{lv.message || message}</span>
      )}
      <span className="vo-cap">
      <button type="button" className="vo-btn vo-live" aria-pressed={on} onClick={toggleLive} disabled={lv.phase === "connecting"}
        aria-label={on ? "End voice mode" : "Voice mode"} data-tip={on ? "End voice (Esc)" : "Talk with RAG"}>
        {on ? <Icon name="x" /> : <i className="vo-seed" aria-hidden="true" />}
      </button>
      {!on && (
        <button type="button" className="vo-btn vo-mic" data-state={state} ref={(el) => { meterRef.current = el; }}
          aria-label={state === "listening" ? "Stop recording" : "Hold to talk"} data-tip="Hold to dictate"
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
      )}
      <button type="button" className="vo-btn vo-spk" aria-pressed={sp.on} data-speaking={sp.speaking}
        aria-label="Read replies aloud" data-tip={sp.speaking ? "Stop speaking" : sp.on ? "Read aloud: on" : "Read aloud: off"}
        onClick={() => setSpeaker(sp.speaking ? false : !sp.on)}>
        <Icon name="volume-2" />
      </button>
      <span className="vo-setw" ref={pop}>
        <button type="button" className="vo-btn vo-set" aria-expanded={open} aria-haspopup="dialog" aria-label="Voice settings" data-tip="Voice settings" onClick={() => setOpen((v) => !v)}>
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
      </span>
    </>
  );
}
