"use client";
import { useEffect, useRef } from "react";

interface Props {
  /** Panel rect the particles materialize from. */
  rect: DOMRect;
  onDone: () => void;
}

const COUNT = 650;          // dense enough that the window fading out underneath is barely visible
const DURATION = 1700;      // ms

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Reads a CSS custom property to a color string, falling back to a default. */
function tokenColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function SendAnimation({ rect, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      done.current();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) { done.current(); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { done.current(); return; }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const accent = tokenColor("--accent", "#9c40ff");
    const glow = tokenColor("--accent-glow", accent);
    const text = tokenColor("--text", "#ffffff");
    const palette = [accent, accent, glow, text];

    // Particles fill the panel, then drift up and out the top of the screen,
    // fading as they rise. A per-particle delay staggers the materialize.
    const parts = Array.from({ length: COUNT }, () => {
      const sx = rect.left + Math.random() * rect.width;
      const sy = rect.top + Math.random() * rect.height;
      return {
        sx, sy,
        rise: sy + 100 + Math.random() * 160,   // travel far enough to clear the top edge
        drift: (Math.random() - 0.5) * 50,       // gentle sideways drift
        wobAmp: 3 + Math.random() * 10,
        wobFreq: 1 + Math.random() * 3,
        phase: Math.random() * Math.PI * 2,
        delay: Math.random() * 0.25,             // stagger the rise
        size: 0.8 + Math.random() * 2.4,
        color: palette[(Math.random() * palette.length) | 0],
      };
    });

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const gt = (now - start) / DURATION;       // 0..1
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (const p of parts) {
        const te = Math.min(Math.max((gt - p.delay) / (1 - p.delay), 0), 1);
        if (te <= 0) continue;
        const e = easeOut(te);
        const x = p.sx + p.drift * e + Math.sin(p.phase + te * p.wobFreq * Math.PI * 2) * p.wobAmp;
        const y = p.sy - p.rise * e;
        const fadeIn = Math.min(te / 0.12, 1);
        const fadeOut = te < 0.45 ? 1 : 1 - (te - 0.45) / 0.55;
        ctx.globalAlpha = Math.max(0, fadeIn * fadeOut);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      if (now - start < DURATION) {
        raf = requestAnimationFrame(frame);
      } else {
        done.current();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [rect]);

  return <canvas ref={canvasRef} className="composer-send-canvas" aria-hidden="true" />;
}
