"use client";
import { useMemo } from "react";
import KineticName, { type Frame } from "@/components/site/kinetic/KineticName";
import "./fx.css";

const POOL = 10;
type Drip = { on: boolean; x: number; y: number; vy: number; r: number; age: number };

/** Liquid-metal drips: hot letters bead at their foot, the bead swells, lets go and falls; the goo filter on the
 *  live name melts beads and letters together. State lives in the closure, one per mounted name. */
function makeDrips(): { frame: Frame; rest: (root: HTMLElement) => void } {
  const ds: Drip[] = Array.from({ length: POOL }, () => ({ on: false, x: 0, y: 0, vy: 0, r: 0, age: 0 }));
  let last = 0;
  const frame: Frame = (root, ls, els, _p, now, fs) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const spans = root.querySelectorAll<HTMLElement>(".mc-drip");
    if (!spans.length) return;
    const rr = root.getBoundingClientRect(), ox = rr.left + scrollX, oy = rr.top + scrollY;
    ls.forEach((l, i) => {
      if (l.k < 0.5 || Math.random() > l.k * 0.05) return;
      const d = ds.find((q) => !q.on);
      if (!d) return;
      const w = els[i].offsetWidth;
      Object.assign(d, { on: true, x: l.cx - ox + (Math.random() - 0.5) * w * 0.5, y: l.cy - oy + fs * 0.26, vy: 0, r: fs * (0.07 + Math.random() * 0.05), age: 0 });
    });
    ds.forEach((d, i) => {
      const s = spans[i];
      if (!d.on) { s.style.opacity = "0"; return; }
      d.age += dt;
      if (d.age > 0.35) { d.vy += fs * 9 * dt; d.y += d.vy * dt; } // hangs, swelling, then lets go
      const grow = Math.min(1, d.age / 0.35), stretch = 1 + Math.min(0.9, d.vy / (fs * 6));
      if (d.y > rr.height + fs) d.on = false;
      s.style.opacity = "1";
      s.style.transform = `translate3d(${(d.x - d.r).toFixed(1)}px, ${(d.y - d.r).toFixed(1)}px, 0) scale(${(grow / stretch ** 0.5).toFixed(3)}, ${(grow * stretch).toFixed(3)})`;
      s.style.width = s.style.height = `${(d.r * 2).toFixed(1)}px`;
    });
  };
  const rest = (root: HTMLElement) => { ds.forEach((d) => (d.on = false)); root.querySelectorAll<HTMLElement>(".mc-drip").forEach((s) => (s.style.opacity = "0")); last = 0; };
  return { frame, rest };
}

/** Mercury: letters near the pointer sag and stretch like warm metal and shed liquid drips that melt into them. */
export default function MercuryName({ first, last }: { first: string; last: string }) {
  const { frame, rest } = useMemo(() => makeDrips(), []);
  return (
    <KineticName first={first} last={last} look="mercury" feel={{ push: 0.05, drag: 0.07, release: 1.6, stiff: 90, damp: 8 }} frame={frame} rest={rest}>
      <svg width="0" height="0" focusable="false">
        <filter id="mc-goo" x="-10%" y="-10%" width="120%" height="140%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 20 -8" result="g" />
          <feComposite in="SourceGraphic" in2="g" operator="over" />
        </filter>
      </svg>
      {Array.from({ length: POOL }, (_, i) => <i key={i} className="mc-drip" />)}
    </KineticName>
  );
}
