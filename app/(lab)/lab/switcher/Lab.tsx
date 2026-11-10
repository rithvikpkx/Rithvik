"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import SiteProvider from "@/components/site/SiteProvider";
import DesignProvider from "@/components/site/DesignProvider";
import Switcher from "@/components/site/switcher/Switcher";
import { DESIGNS } from "@/lib/designs/registry";
import { fixture } from "@/lib/content/fixture";
import type { Theme } from "@/lib/types";
import "./lab.css";

const PALETTES: [string, string, string, string][] = [
  ["github-light", "GitHub Light", "#ffffff", "#1f2328"], ["github-dark", "GitHub Dark", "#0d1117", "#e6edf3"], ["solarized", "Solarized", "#fdf6e3", "#586e75"],
  ["dracula", "Dracula", "#282a36", "#f8f8f2"], ["nord", "Nord", "#2e3440", "#d8dee9"], ["gruvbox", "Gruvbox", "#fbf1c7", "#3c3836"],
  ["monokai", "Monokai", "#272822", "#f8f8f2"], ["tokyo", "Tokyo Night", "#1a1b26", "#c0caf5"], ["rose", "Rose Pine", "#191724", "#e0def4"],
  ["one-light", "One Light", "#fafafa", "#383a42"], ["ayu", "Ayu", "#0b0e14", "#bfbdb6"], ["catppuccin", "Catppuccin", "#1e1e2e", "#cdd6f4"],
  ["night-owl", "Night Owl", "#011627", "#d6deeb"], ["paper", "Paper", "#f5f0e6", "#2b2b2b"], ["terminal", "Terminal", "#000000", "#33ff66"], ["sand", "Sand", "#efe4cf", "#3d3226"],
];
const ACCENTS = ["#0969da", "#58a6ff", "#268bd2", "#bd93f9", "#88c0d0", "#d65d0e", "#a6e22e", "#7aa2f7", "#ebbcba", "#4078f2", "#e6b450", "#f5c2e7", "#82aaff", "#c0392b", "#33ff66", "#b5651d"];
const palettes = PALETTES.map(([slug, name, bg, text], i): Theme => ({
  id: slug, slug, name, sort_order: i, published: true, created_at: "", updated_at: "", tokens: { bg, "bg-soft": bg, text, muted: text, accent: ACCENTS[i], "accent-glow": ACCENTS[i], green: "#3fb950" },
}));

type Swatch = { name: string; bg: string; ac: string; fg: string };
const SW: Swatch[] = [
  ...DESIGNS.map((d) => ({ name: d.name, bg: d.swatch[0], fg: d.swatch[1], ac: d.swatch[2] })),
  ...palettes.map((p) => ({ name: p.name, bg: p.tokens.bg, fg: p.tokens.text, ac: p.tokens.accent })),
];
const ORB = (s: Swatch) => `radial-gradient(circle at 34% 27%, rgba(255,255,255,.5), transparent 34%), radial-gradient(circle at 63% 67%, ${s.ac} 0 33%, transparent 34.5%), ${s.bg}`;

/** Concept B, "thread": beads on an elastic string. Drag along it with momentum; the bead at the gate is the
 *  look. The string plucks toward the pointer and the beads swell near the gate. */
function Thread() {
  const [pos, setPos] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const st = useRef({ p: 0, v: 0, raf: 0, last: 0, drag: null as null | { x: number; y: number; p0: number; id: number }, pluck: 0, pv: 0, snapped: 0 });
  const GAP = 38, GATE = 210, N = SW.length;
  const paint = () => {
    const s = st.current, el = root.current;
    if (!el) return;
    let d = "";
    SW.forEach((_, i) => {
      const x = GATE + (i - s.p) * GAP, dx = x - GATE;
      const k = Math.exp(-((dx / 56) ** 2)), sz = 0.34 + 0.9 * k;
      const y = 86 + s.pluck * Math.exp(-((dx / 110) ** 2)) + 0.00018 * dx * dx;
      const b = el.children[i + 1] as HTMLElement;
      b.style.transform = `translate(${x}px,${y}px) scale(${sz})`;
      b.style.opacity = String(Math.min(1, 1.6 - Math.abs(dx) / 160));
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    });
    (el.children[0].firstChild as SVGPathElement).setAttribute("d", d);
  };
  const frame = (t: number) => {
    const s = st.current, dt = Math.min(32, s.last ? t - s.last : 16);
    s.last = t;
    if (!s.drag) {
      const target = Math.max(0, Math.min(N - 1, Math.round(s.p)));
      s.v += (-0.0009 * (s.p - target) - 0.03 * s.v) * dt;
      s.p += s.v * dt;
    }
    s.pv += (-0.0012 * s.pluck - 0.035 * s.pv) * dt;
    s.pluck += s.pv * dt;
    paint();
    const idx = Math.max(0, Math.min(N - 1, Math.round(s.p)));
    if (idx !== s.snapped) { s.snapped = idx; setPos(idx); }
    if (!s.drag && Math.abs(s.v) < 0.0004 && Math.abs(s.p - Math.round(s.p)) < 0.002 && Math.abs(s.pluck) < 0.1) { s.raf = 0; s.last = 0; return; }
    s.raf = requestAnimationFrame(frame);
  };
  const run = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(frame); };
  useEffect(() => { paint(); return () => cancelAnimationFrame(st.current.raf); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const down = (e: PointerEvent) => { const s = st.current; s.drag = { x: e.clientX, y: e.clientY, p0: s.p, id: e.pointerId }; s.v = 0; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); run(); };
  const move = (e: PointerEvent) => {
    const s = st.current, d = s.drag;
    if (!d) return;
    const np = Math.max(-0.6, Math.min(N - 0.4, d.p0 - (e.clientX - d.x) / GAP));
    s.v = (np - s.p) / 16 * 0.6 + s.v * 0.4;
    s.p = np;
    s.pluck = Math.max(-38, Math.min(38, (e.clientY - d.y) * 0.8));
  };
  const up = () => { st.current.drag = null; run(); };
  return (
    <figure>
      <div ref={root} className="lab-stage lab-thread" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <svg width="420" height="170"><path fill="none" strokeWidth="1.5" /></svg>
        {SW.map((s, i) => <i key={i} className="lab-bead" style={{ background: ORB(s) }} />)}
        <span className="lab-gate" />
      </div>
      <figcaption><b>B · Thread</b> {SW[pos].name}</figcaption>
    </figure>
  );
}

/** Concept C, "liquid": a blob you drag to a droplet; a gooey filter fuses them and the core takes the colour. */
function Liquid() {
  const [cur, setCur] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tvx: 0, tvy: 0, drag: false, raf: 0, last: 0, hot: -1 });
  const dots = useMemo(() => SW.map((_, i) => {
    const des = i < 9, n = des ? 9 : SW.length - 9, k = des ? i : i - 9, r = des ? 66 : 100, a = -Math.PI / 2 + ((k + (des ? 0 : 0.5)) / n) * Math.PI * 2;
    return { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r), r: des ? 11 : 6.5 }; // rounded: float text differs server/client
  }), []);
  const paint = () => {
    const s = st.current, el = root.current;
    if (!el) return;
    (el.querySelector(".lab-core") as HTMLElement).style.transform = `translate(${s.x}px,${s.y}px)`;
    (el.querySelector(".lab-tail") as HTMLElement).style.transform = `translate(${s.tx}px,${s.ty}px) scale(.7)`;
  };
  const frame = (t: number) => {
    const s = st.current, dt = Math.min(32, s.last ? t - s.last : 16);
    s.last = t;
    if (!s.drag) { s.vx += (-0.0014 * s.x - 0.03 * s.vx) * dt; s.vy += (-0.0014 * s.y - 0.03 * s.vy) * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    s.tvx += (-0.0016 * (s.tx - s.x) - 0.04 * s.tvx) * dt; s.tvy += (-0.0016 * (s.ty - s.y) - 0.04 * s.tvy) * dt;
    s.tx += s.tvx * dt; s.ty += s.tvy * dt;
    paint();
    if (!s.drag && Math.hypot(s.x, s.y, s.vx * 50, s.vy * 50, s.tx - s.x, s.ty - s.y) < 0.3) { s.raf = 0; s.last = 0; s.tx = s.x = s.ty = s.y = 0; paint(); return; }
    s.raf = requestAnimationFrame(frame);
  };
  const run = () => { const s = st.current; if (!s.raf) s.raf = requestAnimationFrame(frame); };
  useEffect(() => () => cancelAnimationFrame(st.current.raf), []);
  const near = (x: number, y: number) => dots.findIndex((d, i) => i !== cur && Math.hypot(d.x - x, d.y - y) < d.r + 18);
  const move = (e: PointerEvent) => {
    const s = st.current;
    if (!s.drag) return;
    const r = root.current!.getBoundingClientRect();
    s.x = e.clientX - r.left - r.width / 2; s.y = e.clientY - r.top - r.height / 2;
    s.hot = near(s.x, s.y);
  };
  const up = () => { const s = st.current; s.drag = false; if (s.hot >= 0) setCur(s.hot); s.hot = -1; run(); };
  return (
    <figure>
      <div ref={root} className="lab-stage lab-liquid" onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <svg width="0" height="0"><filter id="goo"><feGaussianBlur stdDeviation="6" /><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" /></filter></svg>
        <div className="lab-goo">
          {dots.map((d, i) => i !== cur && <i key={i} className="lab-drop" style={{ width: d.r * 2, height: d.r * 2, margin: `${-d.r}px 0 0 ${-d.r}px`, left: "50%", top: "50%", transform: `translate(${d.x}px,${d.y}px)`, background: SW[i].ac }} />)}
          <i className="lab-tail" style={{ background: SW[cur].ac }} />
          <i className="lab-core" style={{ background: SW[cur].ac }} onPointerDown={(e) => { st.current.drag = true; e.currentTarget.setPointerCapture(e.pointerId); run(); }} />
        </div>
        <i className="lab-eye" style={{ background: SW[cur].bg, boxShadow: `inset 0 0 0 3px ${SW[cur].fg}55` }} />
      </div>
      <figcaption><b>C · Liquid</b> {SW[cur].name}</figcaption>
    </figure>
  );
}

/** Harness: concept A is the real component (fixed bottom-left, hover/tap it); B and C are throwaway prototypes. */
export default function Lab() {
  return (
    <SiteProvider content={fixture}>
      <DesignProvider initial="github-light" palettes={palettes}>
        <main className="lab-page">
          <h1>Look switcher: three concepts</h1>
          <p>A · Orbit is the shipped component (bottom-left of this page: hover or tap it). B and C are prototypes.</p>
          <div className="lab-row"><Thread /><Liquid /></div>
        </main>
        <Switcher />
      </DesignProvider>
    </SiteProvider>
  );
}
