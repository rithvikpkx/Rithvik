"use client";
import Mark from "../mark/Mark";
import { useEffect, useRef, useState } from "react";
import { useSite } from "../SiteProvider";
import { Deck } from "./deck";
import { Icon as Ic } from "../Glyph";

const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The Records toy: a tilted photographic LP you can drag to scratch, and a goo-filter pill player whose play button detaches while playing. */
export default function Records() {
  const { toast } = useSite();
  const [on, setOn] = useState(false);
  const [scratching, setScratching] = useState(false);
  const deck = useRef<Deck | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const spin = useRef<HTMLDivElement>(null);
  const pos = useRef<HTMLSpanElement>(null);
  const dur = useRef<HTMLSpanElement>(null);
  const prog = useRef<HTMLElement>(null);

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
        disc.current?.setAttribute("aria-valuenow", p.toFixed(0));
        disc.current?.setAttribute("aria-valuetext", fmt(p));
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

  return (
    <div className={`records${on ? " is-on" : ""}${scratching ? " is-scratching" : ""}`} id="records" ref={wrap}>
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute" }}>
        <filter id="rec-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="9" result="b" /><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g" /><feComposite in="SourceGraphic" in2="g" operator="atop" /></filter>
      </svg>
      <div className="rec-stage">
        <div className="rec-platter">
          <div
            className="rec-disc" id="rec-disc" ref={disc} role="slider" tabIndex={0}
            aria-label="Record. Drag, or use the arrow keys, to scratch" aria-valuemin={0} aria-valuemax={72} aria-valuenow={0} aria-valuetext="0:00"
            onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); deck.current?.grab(angleAt(e)); }}
            onPointerMove={(e) => deck.current?.move(angleAt(e))}
            onPointerUp={() => deck.current?.release()}
            onPointerCancel={() => deck.current?.release()}
            onKeyDown={(e) => {
              const dir = ({ ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 } as Record<string, 1 | -1>)[e.key];
              if (!dir) return;
              e.preventDefault();
              deck.current?.nudge(dir);
            }}
          >
            <div className="rec-spin" id="rec-spin" ref={spin}>
              {/* a rotating LP photo: next/image adds nothing here */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rec-photo" src="/v7/record.jpg" alt="" width={960} height={960} draggable={false} />
              <div className="rec-label"><span className="rl-mark"><Mark label="" /></span><span className="rl-title">Chili Pepper</span><span className="rl-sub">Fred Longshaw · 1927</span><span className="rl-side">Side A · 78</span></div>
            </div>
            <i className="rec-sheen" aria-hidden="true" />
            <i className="rec-spindle" aria-hidden="true" />
          </div>
        </div>
        <svg className="rec-arm" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="arm-metal" x1="0" x2="1"><stop offset="0" stopColor="#f4f4f6" /><stop offset=".5" stopColor="#c4c4ca" /><stop offset="1" stopColor="#8e8e95" /></linearGradient>
            <radialGradient id="arm-pivot" cx=".35" cy=".35" r=".8"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#bdbdc3" /><stop offset="1" stopColor="#6d6d74" /></radialGradient>
          </defs>
          <g className="arm">
            <rect x="89.6" y="-1.5" width="7" height="9" rx="2" fill="#5c5c62" />
            <path d="M90 12 L83 30 L69 64" fill="none" stroke="url(#arm-metal)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M69 64 L63.5 71.5" fill="none" stroke="url(#arm-metal)" strokeWidth="2" strokeLinecap="round" />
            <g transform="rotate(36 61 74)"><rect x="56" y="71" width="10" height="6" rx="1.4" fill="#1f1f23" /><rect x="57" y="76.4" width="3" height="1.6" rx=".4" fill="#c9a25b" /></g>
            <circle cx="90" cy="12" r="7" fill="url(#arm-pivot)" />
            <circle cx="90" cy="12" r="2.6" fill="#55555b" />
          </g>
        </svg>
      </div>
      <div className="rec-side">
        <div className="rec-pill-wrap">
          <div className="goo" aria-hidden="true"><i className="goo-pill" /><i className="goo-btn" /></div>
          <div className="rec-pill">
            <span className="rp-disc" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/v7/record.jpg" alt="" width={40} height={40} />
            </span>
            <span className="rp-meta"><b>Chili Pepper</b><span>Fred Longshaw, 1927</span></span>
            <span className="rp-time">
              <span ref={pos}>0:00</span>
              <span className="rp-bar" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); deck.current?.seek((e.clientX - r.left) / r.width); }}><i ref={prog} /></span>
              <span ref={dur}>1:12</span>
            </span>
          </div>
          <button className="rec-play" type="button" aria-pressed={on} aria-label={on ? "Pause" : "Play"} onClick={() => deck.current?.toggle()}>
            <Ic name="play" className="ic ic-play" /><Ic name="pause" className="ic ic-pause" />
          </button>
        </div>
        <p className="rec-hint">Drag the record to scratch. Arrow keys work too.</p>
      </div>
    </div>
  );
}
