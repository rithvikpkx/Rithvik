"use client";
import { useEffect, useRef, useState } from "react";
import { clamp01, snap } from "@/lib/play/deckmap";

const SWEEP = 270; // degrees of travel, from -135 to +135
const TICKS = 21;

type Props = {
  label: string;
  /** 0..1 */
  value: number;
  onChange: (v: number) => void;
  /** Double-click / reset target. A bipolar knob (default 0.5) also has a centre detent that holds the drag. */
  def?: number;
  bipolar?: boolean;
  /** Spoken and shown value, e.g. "Low-pass 1.2 kHz". */
  text: string;
};

/** A deck knob: vertical drag, wheel and arrow keys turn it; a tick ring shows the travel, a centre detent holds bipolar knobs, and the cap springs when it settles. `role="slider"`. */
export default function Knob({ label, value, onChange, def = 0.5, bipolar = false, text }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const raw = useRef(value); // the unsnapped drag position, so the detent can hold and then release
  const drag = useRef<{ y: number; v: number } | null>(null);
  const [touch, setTouch] = useState(false);
  const [held, setHeld] = useState(false);
  const cb = useRef(onChange);
  cb.current = onChange;

  /** Commits a new value (clamped, and snapped to the centre detent on bipolar knobs). */
  const put = (v: number, free = false) => {
    raw.current = clamp01(v);
    const out = bipolar && !free ? snap(raw.current) : raw.current;
    if (out !== value) cb.current(Math.round(out * 1000) / 1000);
  };

  // the wheel needs a non-passive listener so the page does not scroll under a knob
  useEffect(() => {
    const n = el.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : 1;
      raw.current = clamp01(raw.current - (e.deltaY * k) / 700);
      const out = bipolar ? snap(raw.current, 0.5, 0.012) : raw.current;
      cb.current(Math.round(out * 1000) / 1000);
    };
    n.addEventListener("wheel", wheel, { passive: false });
    return () => n.removeEventListener("wheel", wheel);
  }, [bipolar]);

  const deg = (value - 0.5) * SWEEP;
  const from = bipolar ? Math.min(0.5, value) : 0, to = bipolar ? Math.max(0.5, value) : value;
  const seg = (to - from) * 0.75; // fraction of the full circle
  return (
    <div className="dk-cell" data-live={touch || held ? "" : undefined}>
      <div
        ref={el} className="dk-knob" role="slider" tabIndex={0} aria-label={label}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)} aria-valuetext={text}
        data-drag={held ? "" : undefined}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          raw.current = value;
          drag.current = { y: e.clientY, v: value };
          setHeld(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          put(d.v + (d.y - e.clientY) / (e.shiftKey ? 600 : 170));
        }}
        onPointerUp={() => { drag.current = null; setHeld(false); }}
        onPointerCancel={() => { drag.current = null; setHeld(false); }}
        onDoubleClick={() => put(def, true)}
        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setTouch(true); }}
        onBlur={() => setTouch(false)}
        onKeyDown={(e) => {
          const s = e.shiftKey ? 0.1 : 0.02;
          const d: Record<string, number> = { ArrowUp: s, ArrowRight: s, ArrowDown: -s, ArrowLeft: -s, PageUp: 0.1, PageDown: -0.1 };
          if (e.key in d) { e.preventDefault(); put(value + d[e.key], true); }
          else if (e.key === "Home") { e.preventDefault(); put(0, true); }
          else if (e.key === "End") { e.preventDefault(); put(1, true); }
        }}
      >
        <svg viewBox="-50 -50 100 100" aria-hidden="true">
          {Array.from({ length: TICKS }, (_, i) => {
            const t = i / (TICKS - 1), a = ((t - 0.5) * SWEEP * Math.PI) / 180, major = i % 5 === 0 || (bipolar && i === 10);
            const r0 = major ? 41.5 : 44, sx = Math.sin(a), sy = -Math.cos(a);
            const lit = bipolar ? t >= from - 1e-6 && t <= to + 1e-6 : t <= value + 1e-6;
            return <line key={i} className="dk-tick" data-on={lit ? "" : undefined} data-major={major ? "" : undefined} x1={sx * r0} y1={sy * r0} x2={sx * 48} y2={sy * 48} />;
          })}
          <circle className="dk-track" r="37" pathLength={1000} strokeDasharray="750 1000" transform="rotate(135)" />
          <circle className="dk-arc" r="37" pathLength={1000} strokeDasharray={`${Math.max(0.5, seg * 1000)} 1000`} strokeDashoffset={-from * 750} transform="rotate(135)" />
        </svg>
        <i className="dk-cap" style={{ ["--deg" as string]: `${deg}deg` }}><b /></i>
      </div>
      <span className="dk-name" aria-hidden="true">{label}</span>
    </div>
  );
}
