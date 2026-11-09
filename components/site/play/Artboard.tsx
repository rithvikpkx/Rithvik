"use client";
import { useEffect, useRef, useState } from "react";
import { Icon as Ic } from "../Glyph";

type Stroke = { pts: [number, number][]; size: number; color: string; erase: boolean; mirror: boolean };

const INK = ["#111111", "#ff3b1f", "#2230ff", "#00b86b", "#ffb000", "#ff5cf0"];
const SIZES: [number, string, string][] = [[3, "Fine pen", "4px"], [6, "Medium pen", "8px"], [14, "Thick pen", "14px"]];
const PROMPTS = ["Draw a brain wave", "Draw the robotic arm", "Draw your dream internship", "Draw a QR code from memory", "Draw a snake eating its tail"];

/** Strokes one smoothed stroke (midpoint quadratic curves); `flip` mirrors it across the vertical centre line of a `w`-wide board. */
function path(g: CanvasRenderingContext2D, s: Stroke, w: number, flip: boolean) {
  const pts = flip ? s.pts.map(([x, y]): [number, number] => [w - x, y]) : s.pts;
  g.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
  g.strokeStyle = s.color; g.lineWidth = s.size; g.lineCap = g.lineJoin = "round";
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2];
    g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  const l = pts[pts.length - 1];
  g.lineTo(l[0], l[1]); g.stroke();
}

/** The Artboard toy: free drawing on a dotted sheet with smoothing, three pens, six inks, mirror symmetry, eraser, undo and clear. */
export default function Artboard({ hidden = false }: { hidden?: boolean }) {
  const [size, setSize] = useState(6);
  const [color, setColor] = useState(INK[0]);
  const [erase, setErase] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [cue, setCue] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const cur = useRef<Stroke | null>(null);
  const tool = useRef({ size, color, erase, mirror });
  useEffect(() => { tool.current = { size, color, erase, mirror }; }, [size, color, erase, mirror]);

  /** Repaints every stroke from scratch (cheap at this scale, and keeps eraser + mirror exact). */
  const redraw = () => {
    const c = cv.current, g = c?.getContext("2d");
    if (!c || !g) return;
    const r = c.getBoundingClientRect();
    g.clearRect(0, 0, r.width, r.height);
    for (const s of strokes.current) { path(g, s, r.width, false); if (s.mirror) path(g, s, r.width, true); }
  };

  // Keeps the backing store sharp (dpr, capped at 2) whenever the board resizes; a hidden board has width 0 and is skipped.
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      if (!r.width) return;
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
      c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, []);

  const at = (e: React.PointerEvent): [number, number] => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  return (
    <div className="play-pane ab" data-pane="artboard" hidden={hidden}>
      <div className="ab-tools" id="ab-tools">
        <button type="button" className="ab-cue" onClick={() => setCue((cue + 1) % PROMPTS.length)}>{PROMPTS[cue]}</button>
        <span className="ab-inks">
          {INK.map((c, i) => (
            <button key={c} type="button" className="ab-ink" style={{ "--ink": c } as React.CSSProperties} aria-label={`Ink ${i + 1}`} aria-pressed={!erase && color === c} onClick={() => { setColor(c); setErase(false); }} />
          ))}
        </span>
        <span className="ab-sizes">
          {SIZES.map(([n, label, d]) => (
            <button key={n} type="button" aria-label={label} aria-pressed={size === n} onClick={() => setSize(n)}><i style={{ "--d": d } as React.CSSProperties} /></button>
          ))}
        </span>
        <button type="button" aria-pressed={mirror} onClick={() => setMirror(!mirror)}>Mirror</button>
        <button type="button" aria-pressed={erase} onClick={() => setErase(!erase)}>Eraser</button>
        <button type="button" aria-label="Undo" onClick={() => { strokes.current.pop(); redraw(); }}><Ic name="rotate-ccw" /></button>
        <button type="button" onClick={() => { strokes.current = []; redraw(); }}>Clear</button>
      </div>
      <div className="ab-paper">
        <canvas
          id="ab-canvas" ref={cv} aria-label="Drawing board"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const s: Stroke = { pts: [at(e), at(e)], ...tool.current };
            cur.current = s; strokes.current.push(s);
            const r = e.currentTarget.getBoundingClientRect(), g = e.currentTarget.getContext("2d")!;
            path(g, s, r.width, false); if (s.mirror) path(g, s, r.width, true);
          }}
          onPointerMove={(e) => { if (!cur.current) return; cur.current.pts.push(at(e)); redraw(); }}
          onPointerUp={() => { cur.current = null; }}
          onPointerCancel={() => { cur.current = null; }}
        />
        <i className="ab-axis" hidden={!mirror} />
      </div>
    </div>
  );
}
