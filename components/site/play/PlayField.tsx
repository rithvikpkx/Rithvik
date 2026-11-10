"use client";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PLAY } from "@/lib/play/games";
import { copiesFor, onScreen, place, velocity, wrap } from "@/lib/play/field";
import "./playfield.css";

/** One composed tile of the plane (world px). Toys first (their `k` is the PLAY id), then decoration. */
type Spot = { k: string; x: number; y: number; w: number; h: number; r?: number };
const TW = 1240, TH = 900, PAD = 360; // PAD > the largest spot plus its label, so copies only wrap out of sight
const SPOTS: Spot[] = [
  { k: "records", x: 70, y: 80, w: 270, h: 270 },
  { k: "artboard", x: 470, y: 150, w: 250, h: 230, r: -4 },
  { k: "typeracer", x: 840, y: 70, w: 320, h: 150, r: 5 },
  { k: "angle", x: 880, y: 430, w: 230, h: 210 },
  { k: "dots", x: 420, y: 520, w: 150, h: 270, r: 8 },
  { k: "center", x: 90, y: 530, w: 230, h: 230 },
  { k: "cube", x: 700, y: 560, w: 96, h: 96 },
  { k: "ring", x: 1110, y: 720, w: 110, h: 110 },
  { k: "tri", x: 380, y: 50, w: 70, h: 64, r: 12 },
  { k: "squig", x: 600, y: 440, w: 180, h: 54, r: -8 },
  { k: "half", x: 260, y: 420, w: 110, h: 55, r: -14 },
  { k: "spark", x: 1180, y: 300, w: 56, h: 56 },
  { k: "ball", x: 760, y: 280, w: 64, h: 64 },
  { k: "pill", x: 620, y: 770, w: 140, h: 44, r: -18 },
  { k: "arch", x: 980, y: 760, w: 90, h: 90, r: 90 },
  { k: "dot", x: 760, y: 70, w: 22, h: 22 },
  { k: "dotgrid", x: 30, y: 400, w: 72, h: 72 },
  { k: "dot", x: 340, y: 840, w: 16, h: 16 },
];
const TOYS = new Map(PLAY.map((p) => [p.id, p]));
const LABEL_H = 44; // the name tag under a toy counts towards its on-screen box

/** Mutable pan state, kept out of React so moving never re-renders. Positions in world px; velocity in px/ms. */
type Pan = { x: number; y: number; vx: number; vy: number; tx: number; ty: number; w: number; h: number; s: number; raf: number; last: number; n: [number, number] };

/** The Play section: an infinite plane of odd shapes, each toy a live miniature, panned by drag (with inertia),
 *  a sideways trackpad swipe, or the arrow keys. A vertical wheel or a vertical touch swipe still scrolls the page. */
export default function PlayField() {
  const frame = useRef<HTMLDivElement>(null);
  const plane = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const pan = useRef<Pan>({ x: 0, y: 0, vx: 0, vy: 0, tx: NaN, ty: NaN, w: 1264, h: 720, s: 1, raf: 0, last: 0, n: [2, 2] });
  const [n, setN] = useState<[number, number]>([2, 2]);
  const paintRef = useRef<() => void>(() => {});

  useEffect(() => {
    const f = frame.current!, s = pan.current, root = document.documentElement;
    const calm = () => root.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;

    /** Writes every copy's transform and flags the ones out of view so their previews pause. */
    const paint = () => {
      const [nx, ny] = s.n, vw = s.w / s.s, vh = s.h / s.s;
      SPOTS.forEach((sp, j) => {
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
          const el = nodes.current.get(`${j}:${a}:${b}`);
          if (!el) continue;
          const px = place(sp.x, s.x, a, TW, nx, PAD), py = place(sp.y, s.y, b, TH, ny, PAD);
          el.style.transform = `translate3d(${px}px,${py}px,0)`;
          const off = !(onScreen(px, sp.w, vw) && onScreen(py, sp.h + LABEL_H, vh));
          if (el.hasAttribute("data-off") !== off) el.toggleAttribute("data-off", off);
        }
      });
      grid.current!.style.transform = `translate3d(${wrap(s.x * s.s, 28) - 28}px,${wrap(s.y * s.s, 28) - 28}px,0)`;
    };
    paintRef.current = paint;

    /** After motion: per toy, the copy nearest the centre is the one in the tab order and the accessibility tree. */
    const settle = () => {
      const [nx, ny] = s.n, cx = s.w / s.s / 2, cy = s.h / s.s / 2, focused = document.activeElement;
      SPOTS.forEach((sp, j) => {
        if (!TOYS.has(sp.k)) return;
        const copies: [HTMLElement, number][] = [];
        for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
          const el = nodes.current.get(`${j}:${a}:${b}`);
          if (el) copies.push([el, Math.hypot(place(sp.x, s.x, a, TW, nx, PAD) + sp.w / 2 - cx, place(sp.y, s.y, b, TH, ny, PAD) + sp.h / 2 - cy)]);
        }
        const live = copies.find(([el]) => el === focused)?.[0] ?? copies.sort((p, q) => p[1] - q[1])[0]?.[0];
        for (const [el] of copies) {
          el.tabIndex = el === live ? 0 : -1;
          if (el === live) el.removeAttribute("aria-hidden"); else el.setAttribute("aria-hidden", "true");
        }
      });
    };

    /** One rAF loop, alive only while gliding to a target or coasting on inertia. */
    const tick = (t: number) => {
      const dt = Math.min(48, t - s.last);
      s.last = t;
      let moving = false;
      if (!Number.isNaN(s.tx)) {
        const k = 1 - Math.pow(0.8, dt / 16.7);
        s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k;
        if (Math.abs(s.tx - s.x) + Math.abs(s.ty - s.y) < 0.5) { s.x = s.tx; s.y = s.ty; s.tx = s.ty = NaN; } else moving = true;
      } else if (s.vx || s.vy) {
        s.x += s.vx * dt; s.y += s.vy * dt;
        const fr = Math.pow(0.95, dt / 16.7); // friction per 60Hz frame, so the throw feels the same at any refresh rate
        s.vx *= fr; s.vy *= fr;
        if (Math.hypot(s.vx, s.vy) < 0.015) s.vx = s.vy = 0; else moving = true;
      }
      paint();
      s.raf = moving ? requestAnimationFrame(tick) : 0;
      if (!moving && !ptr) settle();
    };
    const kick = () => { if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(tick); } };
    const glide = (tx: number, ty: number) => {
      s.vx = s.vy = 0;
      if (calm()) { s.x = tx; s.y = ty; s.tx = s.ty = NaN; } else { s.tx = tx; s.ty = ty; }
      kick();
    };

    // ---- pointer: a press only becomes a drag past 6px; a touch must start sideways (vertical = page scroll)
    let ptr: { id: number; x0: number; y0: number; x: number; y: number; touch: boolean; drag: boolean; samples: [number, number, number][] } | null = null;
    let dragged = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || ptr) return;
      ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, touch: e.pointerType === "touch", drag: false, samples: [] };
      dragged = false;
      s.vx = s.vy = 0; s.tx = s.ty = NaN;
    };
    const move = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      if (!ptr.drag) {
        const dx = e.clientX - ptr.x0, dy = e.clientY - ptr.y0;
        if (Math.hypot(dx, dy) < 6) return;
        if (ptr.touch && Math.abs(dy) > Math.abs(dx)) { ptr = null; return; }
        ptr.drag = true;
        f.setPointerCapture(e.pointerId);
        f.setAttribute("data-drag", "");
        f.setAttribute("data-moved", "");
      }
      s.x += (e.clientX - ptr.x) / s.s; s.y += (e.clientY - ptr.y) / s.s;
      ptr.x = e.clientX; ptr.y = e.clientY;
      ptr.samples.push([e.timeStamp, s.x, s.y]);
      if (ptr.samples.length > 12) ptr.samples.shift();
      kick();
    };
    const up = (e: PointerEvent) => {
      if (!ptr || e.pointerId !== ptr.id) return;
      if (ptr.drag) {
        dragged = true;
        f.removeAttribute("data-drag");
        const last = ptr.samples[ptr.samples.length - 1];
        // a held pause before letting go throws nothing
        if (e.type === "pointerup" && !calm() && last && e.timeStamp - last[0] < 60) [s.vx, s.vy] = velocity(ptr.samples);
      }
      ptr = null;
      kick();
    };
    // a drag that ends over a toy must not open it (capture phase: before SiteProvider's document listener)
    const click = (e: MouseEvent) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } };

    // ---- wheel: a gesture that starts sideways (or with Shift) pans in both axes; one that starts vertical is the page's
    let wheelMode = "", wheelT = -1e9;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom
      if (e.timeStamp - wheelT > 200) wheelMode = Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey ? "pan" : "page";
      wheelT = e.timeStamp;
      if (wheelMode !== "pan") return;
      e.preventDefault();
      f.setAttribute("data-moved", "");
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? s.w : 1;
      let dx = e.deltaX, dy = e.deltaY;
      if (e.shiftKey && !dx) { dx = dy; dy = 0; }
      s.vx = s.vy = 0; s.tx = s.ty = NaN;
      s.x -= (dx * k) / s.s; s.y -= (dy * k) / s.s;
      kick();
    };

    // ---- keys: arrows pan while focus is in the field; a keyboard-focused toy glides to the centre
    const STEP = 280;
    const key = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const d = ({ ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] } as Record<string, number[]>)[e.key];
      if (!d) return;
      e.preventDefault();
      const bx = Number.isNaN(s.tx) ? s.x : s.tx, by = Number.isNaN(s.ty) ? s.y : s.ty;
      glide(bx + d[0] * STEP, by + d[1] * STEP);
    };
    const focus = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      if (!el.matches?.(":focus-visible") || el.dataset.j === undefined) return;
      const sp = SPOTS[+el.dataset.j], [nx, ny] = s.n;
      const px = place(sp.x, s.x, +el.dataset.a!, TW, nx, PAD), py = place(sp.y, s.y, +el.dataset.b!, TH, ny, PAD);
      const vw = s.w / s.s, vh = s.h / s.s;
      if (px < 24 || py < 24 || px + sp.w > vw - 24 || py + sp.h + LABEL_H > vh - 24) glide(s.x + vw / 2 - px - sp.w / 2, s.y + vh / 2 - py - (sp.h + LABEL_H) / 2);
    };
    // focusing a clipped toy must not scroll the frame itself (overflow: clip stops most of it; this catches the rest)
    const noScroll = () => { f.scrollLeft = 0; f.scrollTop = 0; };

    // ---- size: phones see the plane at a smaller scale; the copy count follows the view
    let first = true;
    const ro = new ResizeObserver(() => {
      s.w = f.clientWidth; s.h = f.clientHeight;
      s.s = s.w < 640 ? 0.62 : s.w < 1000 ? 0.8 : 1;
      plane.current!.style.transform = `scale(${s.s})`;
      if (first) { first = false; s.x = s.w / s.s >= TW ? (s.w / s.s - TW) / 2 : -30; /* phones open on the record */ s.y = Math.min(0, (s.h / s.s - TH) / 2 + 60); }
      const nn: [number, number] = [copiesFor(s.w / s.s, TW, PAD), copiesFor(s.h / s.s, TH, PAD)];
      if (nn[0] !== s.n[0] || nn[1] !== s.n[1]) { s.n = nn; setN(nn); }
      paint();
      settle();
    });
    ro.observe(f);
    // previews run only while the field is on screen
    const io = new IntersectionObserver(([en]) => f.toggleAttribute("data-away", !en.isIntersecting));
    io.observe(f);

    f.addEventListener("pointerdown", down);
    f.addEventListener("pointermove", move);
    f.addEventListener("pointerup", up);
    f.addEventListener("pointercancel", up);
    f.addEventListener("click", click, true);
    f.addEventListener("wheel", wheel, { passive: false });
    f.addEventListener("keydown", key);
    f.addEventListener("focusin", focus);
    f.addEventListener("scroll", noScroll);
    f.addEventListener("dragstart", (e) => e.preventDefault());
    return () => {
      cancelAnimationFrame(s.raf); s.raf = 0;
      ro.disconnect(); io.disconnect();
      f.removeEventListener("pointerdown", down);
      f.removeEventListener("pointermove", move);
      f.removeEventListener("pointerup", up);
      f.removeEventListener("pointercancel", up);
      f.removeEventListener("click", click, true);
      f.removeEventListener("wheel", wheel);
      f.removeEventListener("keydown", key);
      f.removeEventListener("focusin", focus);
      f.removeEventListener("scroll", noScroll);
    };
  }, []);

  // a new copy count mounts new nodes at the origin; place them before paint
  useLayoutEffect(() => paintRef.current(), [n]);

  const copies: ReactNode[] = [];
  SPOTS.forEach((sp, j) => {
    const toy = TOYS.get(sp.k);
    for (let a = 0; a < n[0]; a++) for (let b = 0; b < n[1]; b++) {
      const key = `${j}:${a}:${b}`, first = a === 0 && b === 0;
      const style = { "--w": `${sp.w}px`, "--h": `${sp.h}px`, "--r": `${sp.r ?? 0}deg`, transform: `translate3d(${place(sp.x, 0, a, TW, n[0], PAD)}px,${place(sp.y, 0, b, TH, n[1], PAD)}px,0)` } as CSSProperties;
      const ref = (el: HTMLElement | null) => { if (el) nodes.current.set(key, el); else nodes.current.delete(key); };
      copies.push(toy ? (
        <button key={key} ref={ref} type="button" className={`pf-at pf-toy pf-${sp.k}`} style={style} data-play={toy.id} data-j={j} data-a={a} data-b={b}
          tabIndex={first ? 0 : -1} aria-hidden={first ? undefined : true} aria-label={toy.name}>
          <Preview k={sp.k} />
          <span className="pf-name" aria-hidden="true">{toy.name}</span>
        </button>
      ) : (
        <span key={key} ref={ref} className={`pf-at pf-deco pf-${sp.k}`} style={style} aria-hidden="true"><span className="pf-d"><Deco k={sp.k} /></span></span>
      ));
    }
  });

  return (
    <div className="pf-wrap">
      <div className="pf" ref={frame} role="group" aria-label="Play. Drag, swipe sideways or use the arrow keys to look around.">
        <div className="pf-grid" ref={grid} aria-hidden="true" />
        <div className="pf-plane" ref={plane}>{copies}</div>
        <span className="pf-hint" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3M21 12l-3-3m3 3-3 3" /></svg>Drag</span>
      </div>
      <ul className="sr-only">{PLAY.map((p) => <li key={p.id}>{p.name}: {p.desc}</li>)}</ul>
    </div>
  );
}

/** A live miniature of each toy, all CSS-animated (paused off screen; a designed still under lite / reduced motion). */
function Preview({ k }: { k: string }) {
  switch (k) {
    case "records": return (
      <span className="pf-shape">
        <span className="pf-disc"><span className="pf-lab"><i /></span></span>
        <span className="pf-sheen" />
        <span className="pf-arm" />
      </span>
    );
    case "artboard": return (
      <span className="pf-shape">
        <svg viewBox="0 0 100 100">
          {[0, 1].map((m) => (
            <g key={m} transform={m ? "matrix(-1 0 0 1 100 0)" : undefined}>
              <path pathLength={1} d="M50 48 C38 18 8 14 12 38 C15 56 38 56 50 50 C38 62 22 78 34 86 C44 92 50 72 50 52" />
              <path pathLength={1} className="b" d="M49 40 C46 28 40 20 32 16" />
            </g>
          ))}
        </svg>
      </span>
    );
    case "typeracer": return (
      <span className="pf-shape">
        <span className="pf-line"><span className="pf-typed">model.fit(X_train, y_train)</span></span>
        <span className="pf-stub"><b>96</b>wpm</span>
      </span>
    );
    case "angle": return (
      <span className="pf-shape">
        <svg className="pf-arcs" viewBox="-50 -50 100 100"><circle r="34" className="pf-arc0" /><circle r="22" pathLength={360} className="pf-arc" /></svg>
        <span className="pf-ray pf-ray0" /><span className="pf-ray pf-ray1" /><span className="pf-hub" />
      </span>
    );
    case "dots": return (
      <span className="pf-shape">
        {DOTS.map(([x, y, g], i) => <i key={i} className={`g${g}`} style={{ left: `${x}%`, top: `${y}%` }} />)}
      </span>
    );
    case "center": return (
      <span className="pf-shape">
        <span className="pf-cross" /><span className="pf-target" /><span className="pf-box" />
      </span>
    );
    default: return null;
  }
}

// Count the Dots: three flashes of 5, 8 and 6 dots, scattered inside the capsule ([x%, y%, flash]).
const DOTS: [number, number, number][] = [
  [30, 18, 0], [62, 30, 0], [40, 52, 0], [66, 70, 0], [34, 82, 0],
  [28, 14, 1], [56, 20, 1], [70, 38, 1], [36, 36, 1], [58, 54, 1], [30, 64, 1], [64, 78, 1], [44, 86, 1],
  [50, 16, 2], [32, 30, 2], [66, 46, 2], [44, 60, 2], [26, 76, 2], [60, 88, 2],
];

/** The purely decorative shapes that make the field feel composed. */
function Deco({ k }: { k: string }) {
  if (k === "cube") return <span className="pf-box3">{["f", "b", "l", "r", "t", "u"].map((s) => <i key={s} className={s} />)}</span>;
  if (k === "squig") return <svg viewBox="0 0 180 54"><path d="M8 40 C26 4 44 4 54 27 S82 50 94 27 S124 4 136 27 S164 50 172 14" /></svg>;
  if (k === "spark") return <svg viewBox="0 0 56 56"><path d="M28 0 C30 20 36 26 56 28 C36 30 30 36 28 56 C26 36 20 30 0 28 C20 26 26 20 28 0Z" /></svg>;
  return null;
}
