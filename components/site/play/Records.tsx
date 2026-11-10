"use client";
import Mark from "../mark/Mark";
import { useEffect, useRef, useState } from "react";
import { useSite } from "../SiteProvider";
import { Deck } from "./deck";
import { Icon as Ic } from "../Glyph";
import "./records.css";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The Records toy: a physical turntable. Click the record or the lit button to play and pause (the tonearm swings on and lifts off);
 *  drag the record to scratch. */
export default function Records() {
  const { toast } = useSite();
  const [on, setOn] = useState(false);
  const [scratching, setScratching] = useState(false);
  const deck = useRef<Deck | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tt = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const gloss = useRef<HTMLElement>(null);
  const sheen = useRef<HTMLElement>(null);
  const pos = useRef<HTMLSpanElement>(null);
  const dur = useRef<HTMLSpanElement>(null);
  const prog = useRef<HTMLElement>(null);
  // a press on the record becomes a scratch only after it moves; a still press is a click (play/pause)
  const press = useRef<{ x: number; y: number; scratch: boolean } | null>(null);

  // One deck per mount; destroy() stops the audio and closes the context when the tab closes.
  useEffect(() => {
    const d = new Deck({
      spin: (a) => { if (spin.current) spin.current.style.transform = `rotate(${a.toFixed(2)}deg)`; },
      time: (p, total) => {
        const pr = p / total;
        if (pos.current) pos.current.textContent = fmt(p);
        if (dur.current) dur.current.textContent = fmt(total);
        if (prog.current) prog.current.style.transform = `scaleX(${pr.toFixed(4)})`;
        wrap.current?.style.setProperty("--prog", pr.toFixed(3));
      },
      state: (isOn, isScratching) => { setOn(isOn); setScratching(isScratching); },
      fail: () => toast("Audio could not load here. The deck still spins."),
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    deck.current = d;
    return () => { d.destroy(); deck.current = null; };
  }, [toast]);

  /** Pointer angle around the disc centre, in degrees. */
  const angleAt = (e: React.PointerEvent) => {
    const r = disc.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
  };

  /** Slides the studio highlight and the vinyl's fixed sheen with the pointer (transform-only, so it stays on the compositor). */
  const light = (e: React.PointerEvent) => {
    const r = tt.current!.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    if (gloss.current) gloss.current.style.transform = `translate3d(${(nx * 12).toFixed(2)}%,${(ny * 12).toFixed(2)}%,0)`;
    if (sheen.current) sheen.current.style.transform = `rotate(${(nx * 34 + ny * 14).toFixed(1)}deg)`;
  };

  return (
    <div className={`records${on ? " is-on" : ""}${scratching ? " is-scratching" : ""}`} id="records" ref={wrap}>
      <div className="tt-box">
        <div className="tt" ref={tt} onPointerMove={light}>
          <span className="tt-shine" aria-hidden="true"><i className="tt-gloss" ref={gloss} /></span>
          <div className="tt-deck">
            <i className="tt-well" aria-hidden="true" />
            <i className="tt-rim" aria-hidden="true" />
            <div className="tt-spin" ref={spin} aria-hidden="true">
              <i className="tt-strobe" /><i className="tt-mat" /><i className="tt-vinyl" />
              <div className="rec-label"><span className="rl-mark"><Mark label="" /></span><span className="rl-title">Chili Pepper</span><span className="rl-sub">Fred Longshaw · 1927</span><span className="rl-side">Side A · 78</span></div>
            </div>
            <div
              className="tt-disc" id="rec-disc" ref={disc} role="button" tabIndex={0} aria-pressed={on}
              aria-label="Record, Chili Pepper by Fred Longshaw. Click to play or pause, drag to scratch, arrow keys nudge"
              onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); press.current = { x: e.clientX, y: e.clientY, scratch: false }; }}
              onPointerMove={(e) => {
                const p = press.current;
                if (!p) return;
                if (!p.scratch) {
                  if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < 5) return;
                  p.scratch = true;
                  deck.current?.grab(angleAt(e));
                }
                deck.current?.move(angleAt(e));
              }}
              onPointerUp={() => { const p = press.current; press.current = null; if (p?.scratch) deck.current?.release(); else if (p) deck.current?.toggle(); }}
              onPointerCancel={() => { const p = press.current; press.current = null; if (p?.scratch) deck.current?.release(); }}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") { e.preventDefault(); deck.current?.toggle(); return; }
                const dir = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, 1 | -1>)[e.key];
                if (!dir) return;
                e.preventDefault();
                deck.current?.nudge(dir);
              }}
            >
              <i className="tt-sheen" ref={sheen} aria-hidden="true" />
              <i className="tt-spindle" aria-hidden="true" />
            </div>
          </div>

          <i className="tt-rest" aria-hidden="true" />
          <i className="tt-pedestal" aria-hidden="true" />
          <div className="tt-arm" aria-hidden="true">
            <svg viewBox="-70 -40 420 80">
              <defs>
                <linearGradient id="tt-tube" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#d7d9de" /><stop offset=".62" stopColor="#8f929a" /><stop offset="1" stopColor="#5b5e66" /></linearGradient>
                <linearGradient id="tt-cw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a4b52" /><stop offset=".35" stopColor="#2d2e33" /><stop offset="1" stopColor="#141417" /></linearGradient>
                <linearGradient id="tt-head" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3d3e44" /><stop offset="1" stopColor="#17171a" /></linearGradient>
                <radialGradient id="tt-cap" cx=".35" cy=".3" r=".85"><stop offset="0" stopColor="#ffffff" /><stop offset=".5" stopColor="#b9bcc3" /><stop offset="1" stopColor="#5d6068" /></radialGradient>
                <filter id="tt-blur" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="3.2" /></filter>
              </defs>
              {/* cast shadow: tight while the stylus is down, wide and soft while the arm is lifted and parked */}
              <g className="tt-arm-shadow" filter="url(#tt-blur)" fill="#000">
                <rect x="-62" y="-17" width="50" height="34" rx="9" /><rect x="-14" y="-3.5" width="320" height="7" rx="3.5" /><rect x="294" y="-11" width="48" height="22" rx="5" />
              </g>
              <rect x="-62" y="-17" width="50" height="34" rx="9" fill="url(#tt-cw)" />
              <path d="M-48 -17v34M-38 -17v34M-28 -17v34" stroke="#000" strokeOpacity=".35" strokeWidth="1" />
              <rect x="-62" y="-17" width="50" height="34" rx="9" fill="none" stroke="#fff" strokeOpacity=".14" />
              <rect x="-14" y="-3.5" width="320" height="7" rx="3.5" fill="url(#tt-tube)" />
              <rect x="294" y="-11" width="48" height="22" rx="5" fill="url(#tt-head)" stroke="#fff" strokeOpacity=".16" />
              <rect x="304" y="-8" width="28" height="16" rx="3" fill="#0d0d0f" /><rect x="304" y="5" width="28" height="3" rx="1.5" fill="#c9a25b" />
              <path d="M326 11c6 4 10 9 8 16" fill="none" stroke="url(#tt-tube)" strokeWidth="3" strokeLinecap="round" />
              <circle r="15" fill="url(#tt-cap)" /><circle r="5" fill="#46484f" />
            </svg>
          </div>

          <div className="tt-panel">
            <div className="tt-read">
              <span className="tt-time"><span ref={pos}>0:00</span><span ref={dur}>1:12</span></span>
              <span className="tt-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); deck.current?.seek((e.clientX - r.left) / r.width); }}><i ref={prog} /></span>
            </div>
            <button className="tt-btn" type="button" aria-pressed={on} aria-label={on ? "Pause" : "Play"} onClick={() => deck.current?.toggle()}>
              <span className="tt-cap">
                <Ic name="play" className="ic ic-play" /><Ic name="pause" className="ic ic-pause" />
                <span className="tt-btn-t">{on ? "Stop" : "Start"}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
      <p className="rec-hint">Click the record or press start. Drag the record to scratch.</p>
    </div>
  );
}
