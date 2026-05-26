"use client";
import { useEffect, useRef } from "react";

interface Props {
  /** Panel rect the particles emanate from (the message area). */
  rect: DOMRect;
  onDone: () => void;
}

const COUNT = 150;
const DEMAT_MS = 500;          // dematerialize
const MORPH_MS = 700;          // morph into airplane
const FLY_MS = 1000;           // fly off
const TOTAL = DEMAT_MS + MORPH_MS + FLY_MS;

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeIn = (t: number) => t * t;

// A paper-airplane silhouette as points sampled along its edges so particles
// settle into a recognizable plane. Coordinates in a -1..1 box (nose right).
function airplanePoints(n: number, scale: number): { x: number; y: number }[] {
  const verts: [number, number][] = [
    [1, 0], [-1, -0.7], [-0.35, 0],
    [-1, 0.7], [1, 0], [-0.35, 0],
  ];
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const seg = (i / n) * (verts.length - 1);
    const a = verts[Math.floor(seg)];
    const b = verts[Math.min(Math.floor(seg) + 1, verts.length - 1)];
    const f = seg - Math.floor(seg);
    pts.push({
      x: (a[0] + (b[0] - a[0]) * f) * scale,
      y: (a[1] + (b[1] - a[1]) * f) * scale,
    });
  }
  return pts;
}

/** Reads a CSS custom property to a color string, falling back to a default. */
function tokenColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function SendAnimation({ rect, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const done = useRef(onDone);

  // Keep the ref current so the rAF closure always calls the latest onDone
  // without needing it as an effect dependency (which would restart the animation).
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
    const text = tokenColor("--text", "#ffffff");

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const targets = airplanePoints(COUNT, Math.min(rect.width, 220) * 0.35);

    const parts = Array.from({ length: COUNT }, (_, i) => ({
      sx: rect.left + Math.random() * rect.width,
      sy: rect.top + Math.random() * rect.height,
      jx: (Math.random() - 0.5) * 40,
      jy: (Math.random() - 0.5) * 40,
      tx: targets[i].x,
      ty: targets[i].y,
      size: 1 + Math.random() * 2,
      color: Math.random() < 0.5 ? accent : text,
    }));

    const flyDX = window.innerWidth - cx + 200;
    const flyDY = -(cy + 200);

    let raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of parts) {
        let x: number, y: number, alpha = 1;
        if (elapsed < DEMAT_MS) {
          const t = elapsed / DEMAT_MS;
          x = p.sx + p.jx * t;
          y = p.sy + p.jy * t;
        } else if (elapsed < DEMAT_MS + MORPH_MS) {
          const t = easeInOut((elapsed - DEMAT_MS) / MORPH_MS);
          x = (p.sx + p.jx) + (cx + p.tx - (p.sx + p.jx)) * t;
          y = (p.sy + p.jy) + (cy + p.ty - (p.sy + p.jy)) * t;
        } else {
          const t = easeIn(Math.min((elapsed - DEMAT_MS - MORPH_MS) / FLY_MS, 1));
          x = cx + p.tx + flyDX * t;
          y = cy + p.ty + flyDY * t;
          alpha = 1 - t;
        }
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (elapsed < TOTAL) {
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
