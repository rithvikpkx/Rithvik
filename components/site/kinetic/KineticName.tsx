"use client";
import { Fragment, useContext, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { EditModeContext } from "@/components/EditModeProvider";
import { FEEL, letter, step, type Feel, type Letter, type Pointer } from "./engine";
import "./kinetic.css";

/** Per-look feel in em of the name's font size (radius, push, drag) so a phone and a desktop feel alike. */
export type KineticFeel = Partial<Feel>;
/** Called for every letter on every frame the name is live (colour ramps, scrambles, jitter). */
export type Paint = (el: HTMLElement, l: Letter, i: number, now: number) => void;
/** Called once per live frame after the letters (drips, trails); `fs` is the font size in px. */
export type Frame = (root: HTMLElement, ls: Letter[], els: HTMLElement[], p: Pointer, now: number, fs: number) => void;

type Props = {
  first: string;
  last: string;
  /** The look's id, on `data-kn`; kinetic.css and the design's fx CSS hang off it. */
  look: string;
  className?: string;
  firstClass?: string;
  lastClass?: string;
  feel?: KineticFeel;
  paint?: Paint;
  frame?: Frame;
  /** Called when the name falls still, to clear whatever paint/frame set. */
  rest?: (root: HTMLElement, els: HTMLElement[]) => void;
  /** Extra attributes on the root (a design's tracking hooks). */
  rootProps?: Record<string, string>;
  /** Decorative layer drawn over the letters (aria-hidden, unselectable). */
  children?: ReactNode;
};

const EM: Feel = { radius: 1.5, push: 0.08, drag: 0.05, attack: FEEL.attack, release: FEEL.release, stiff: FEEL.stiff, damp: FEEL.damp };
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** Text as letter cells. Each letter is a fixed-width cell (its rest glyph, via a hidden pseudo copy) holding the
 *  live glyph, so weight and transforms never reflow the line. The real characters stay in the DOM. Also used bare
 *  for a static copy that must line up with the kinetic one (Stipple's lens). */
export function Letters({ text, from = 0 }: { text: string; from?: number }) {
  let i = from;
  return text.split(" ").map((w, wi) => (
    <Fragment key={wi}>
      {wi > 0 && " "}
      <span className="kn-w">{[...w].map((ch, ci) => <span key={ci} className="kn-l" data-c={ch} style={{ "--i": i++ } as CSSProperties}><span className="kn-g">{ch}</span></span>)}</span>
    </Fragment>
  ));
}

/** One editable name part as letter cells. */
function Part({ text, edit, className, from }: { text: string; edit: string; className?: string; from: number }) {
  return <span className={`kn-part ${className ?? ""}`.trim()} data-edit={edit}><Letters text={text} from={from} /></span>;
}

/** The hero name with per-letter kinetics: letters near the pointer gain energy (`--k`, 0..1) and spring away
 *  (`--x`/`--y`); a look turns those into its own effect in CSS, plus optional `paint`/`frame` hooks. Calm at rest:
 *  the loop runs only while the pointer is near or something still moves, never off-screen. Touch: a tap sweeps a
 *  virtual pointer across the name; first view plays one sweep as a hint. `html.lite` / reduced motion: static.
 *  While the admin edits inline it renders plain text, so the editor gets one clean text node per field. */
export default function KineticName({ first, last, look, className, firstClass = "ly-first", lastClass = "ly-last", feel, paint, frame, rest, rootProps, children }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const ed = useContext(EditModeContext);
  const plain = !!(ed?.isEditing && ed.inlineOn);
  const hooks = useRef({ paint, frame, rest });
  useEffect(() => { hooks.current = { paint, frame, rest }; });
  const feelKey = JSON.stringify(feel ?? {});

  useEffect(() => {
    const root = ref.current;
    if (!root || plain || calm()) return;
    const els = Array.from(root.querySelectorAll<HTMLElement>(".kn-l"));
    if (!els.length) return;
    const em = { ...EM, ...(JSON.parse(feelKey) as KineticFeel) };
    let f: Feel = FEEL, fs = 16;
    let ls: Letter[] = els.map(() => letter(0, 0));
    let measured = false, visible = false, raf = 0, last = 0, moved = 0, intro = true;
    let p: Pointer = null;
    let sweep: { t0: number; y: number; x0: number; x1: number; dur: number } | null = null;

    /** Rest centres in page coordinates (cells never transform, so this is valid while live) and px feel. */
    const measure = () => {
      fs = parseFloat(getComputedStyle(els[0]).fontSize) || 16;
      f = { ...em, radius: em.radius * fs, push: em.push * fs, drag: em.drag * fs };
      ls = els.map((el, i) => { const r = el.getBoundingClientRect(); return { ...ls[i], cx: r.left + r.width / 2 + scrollX, cy: r.top + r.height / 2 + scrollY }; });
      measured = true;
    };
    const write = (now: number) => {
      const paintFn = hooks.current.paint;
      for (let i = 0; i < els.length; i++) {
        const l = ls[i], s = els[i].style;
        s.setProperty("--k", l.k.toFixed(3));
        s.setProperty("--x", `${l.x.toFixed(2)}px`);
        s.setProperty("--y", `${l.y.toFixed(2)}px`);
        if (p) { s.setProperty("--px", Math.max(-1, Math.min(1, (p.x - l.cx) / f.radius)).toFixed(3)); s.setProperty("--py", Math.max(-1, Math.min(1, (p.y - l.cy) / f.radius)).toFixed(3)); }
        paintFn?.(els[i], l, i, now);
      }
      hooks.current.frame?.(root, ls, els, p, now, fs);
    };
    const stop = () => {
      for (const el of els) for (const v of ["--k", "--x", "--y", "--px", "--py"]) el.style.removeProperty(v);
      hooks.current.rest?.(root, els);
      delete root.dataset.live;
    };
    const tick = (now: number) => {
      raf = 0;
      const dt = last ? (now - last) / 1000 : 1 / 60;
      last = now;
      if (sweep) {
        const u = (now - sweep.t0) / sweep.dur;
        if (u >= 1) { sweep = null; p = null; }
        else { const e = u * u * (3 - 2 * u); p = { x: sweep.x0 + (sweep.x1 - sweep.x0) * e, y: sweep.y, vx: 0.9, vy: 0 }; }
      } else if (p && now - moved > 60) { p.vx *= 0.85; p.vy *= 0.85; } // pointer resting: its velocity fades
      const live = step(ls, p, dt, f);
      write(now);
      if (live && visible) raf = requestAnimationFrame(tick);
      else { last = 0; if (!live) stop(); }
    };
    const wake = () => {
      if (raf || !visible) return;
      if (!measured) measure();
      root.dataset.live = "";
      raf = requestAnimationFrame(tick);
    };
    const runSweep = (y?: number) => {
      if (!measured) measure();
      const r = root.getBoundingClientRect();
      sweep = { t0: performance.now(), y: y ?? r.top + scrollY + r.height * 0.3, x0: r.left + scrollX - f.radius * 0.5, x1: r.right + scrollX + f.radius * 0.5, dur: 1300 };
      wake();
    };

    const onMove = (e: PointerEvent) => {
      if (!visible || e.pointerType === "touch" || sweep) return;
      const r = root.getBoundingClientRect(), reach = (f === FEEL ? 120 : f.radius);
      const inside = e.clientX > r.left - reach && e.clientX < r.right + reach && e.clientY > r.top - reach && e.clientY < r.bottom + reach;
      if (!inside) { if (p) { p = null; wake(); } return; }
      const x = e.clientX + scrollX, y = e.clientY + scrollY, now = e.timeStamp, dt = Math.max(8, now - moved);
      const vx = p ? (x - p.x) / dt : 0, vy = p ? (y - p.y) / dt : 0;
      p = { x, y, vx: p ? p.vx * 0.6 + vx * 0.4 : 0, vy: p ? p.vy * 0.6 + vy * 0.4 : 0 };
      moved = now;
      wake();
    };
    const onLeave = () => { if (p && !sweep) { p = null; wake(); } };
    const onDown = (e: PointerEvent) => { if (e.pointerType === "touch") runSweep(e.clientY + scrollY); };
    const io = new IntersectionObserver(([en]) => {
      visible = !!en?.isIntersecting;
      if (visible && intro) { intro = false; setTimeout(() => { if (visible && !p) runSweep(); }, 900); }
      if (visible) wake();
    });
    const ro = new ResizeObserver(() => { measured = false; });
    io.observe(root); ro.observe(root);
    addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    document.fonts?.ready.then(() => { measured = false; });
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
      stop();
    };
  }, [plain, first, last, feelKey]);

  if (plain) {
    return (
      <span className={`kn ${className ?? ""}`.trim()} data-kn={look} {...rootProps} key="plain">
        <span className={`kn-part ${firstClass ?? ""}`.trim()} data-edit="name.first">{first}</span>{" "}
        <span className={`kn-part ${lastClass ?? ""}`.trim()} data-edit="name.last">{last}</span>
      </span>
    );
  }
  return (
    <span ref={ref} className={`kn ${className ?? ""}`.trim()} data-kn={look} {...rootProps}>
      <Part text={first} edit="name.first" className={firstClass} from={0} />{" "}
      <Part text={last} edit="name.last" className={lastClass} from={[...first.replace(/ /g, "")].length} />
      {children && <span className="kn-fx" aria-hidden="true">{children}</span>}
    </span>
  );
}
