"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useDesign } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import StatusDot from "../StatusDot";
import { detentAngles, nearest, shaped, step, wrap, type Motion } from "./physics";
import "./switcher.css";

const SETTLE_MS = 190; // a detent must hold this long before it commits, so a fast turn switches once
const RING = 58; // jewel ring radius, px (dial box is 132)
const CENTER = 66;

type Look = { id: string; name: string; design: boolean; bg: string; fg: string; ac: string; font?: string };
type Drag = { id: number; cx: number; cy: number; phi: number; raw: number; start: number; moved: boolean; trail: [t: number, raw: number][] };

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The look switcher: a machined instrument on the bottom-left edge. A detented rotary knob (designs, then
 *  palettes) with drag + inertia + spring snap, wheel/arrow steps and clickable jewels; a lever for
 *  performance mode (`html.lite`); a lamp linking to /status. Collapsed to the bare knob until hovered,
 *  focused or tapped. Turning never waits on the page: the readout follows at once and the switch commits
 *  once the knob rests on a detent for SETTLE_MS. */
export default function Switcher() {
  const { entries, current, setDesign } = useDesign();
  const { lite, setLite, toast } = useSite();

  const looks = useMemo<Look[]>(() => entries.map((e) => e.kind === "design"
    ? { id: e.id, name: e.meta.name, design: true, bg: e.meta.swatch[0], fg: e.meta.swatch[1], ac: e.meta.swatch[2], font: e.meta.cardFont }
    : { id: e.id, name: e.name, design: false, bg: e.swatch[0], fg: e.swatch[1], ac: e.swatch[2] }), [entries]);
  const nDesigns = looks.filter((l) => l.design).length;
  const angles = useMemo(() => detentAngles(nDesigns, looks.length - nDesigns), [nDesigns, looks.length]);
  const curIdx = Math.max(0, looks.findIndex((l) => l.id === current));

  const [sel, setSel] = useState(curIdx); // the detent the knob is on: drives readout + tint ahead of the commit
  const [rest, setRest] = useState(() => angles[curIdx]); // rendered angle; changes only while the knob is still
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<number | null>(null); // hovered jewel, shown in the readout

  const unitRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  // Mutable state for the rAF loop and the once-bound listeners (never read during render).
  const s = useRef({
    m: { a: angles[curIdx], v: 0, phase: "snap", target: curIdx } as Motion,
    raf: 0, last: 0, sel: curIdx, commit: 0, closer: 0, wheel: 0, drag: null as Drag | null,
    sent: "", sentAt: 0, angles, looks, current, setDesign,
  });
  useEffect(() => { Object.assign(s.current, { angles, looks, current, setDesign }); });

  /** Writes the knob angle straight to the DOM (no React render per frame). */
  function paint(a: number) { knobRef.current?.style.setProperty("--a", `${a}deg`); }

  /** The knob reached detent `i`: update the readout now, commit the look after it settles. */
  function pick(i: number, commit = true) {
    const st = s.current;
    if (i === st.sel) return;
    st.sel = i;
    setSel(i);
    clearTimeout(st.commit);
    st.commit = 0;
    if (!commit) return;
    st.commit = window.setTimeout(() => {
      st.commit = 0;
      const id = st.looks[st.sel]?.id;
      if (!id) return;
      st.sent = id;
      st.sentAt = performance.now();
      st.setDesign(id); // always: going back to the current look also cancels one still loading
    }, SETTLE_MS);
  }

  /** One animation frame of coast/spring; the loop stops itself once the knob rests. */
  function frame(t: number) {
    const st = s.current;
    const done = step(st.m, st.angles, st.last ? t - st.last : 16);
    st.last = t;
    paint(st.m.a);
    pick(st.m.phase === "snap" ? st.m.target : nearest(st.angles, st.m.a));
    if (done) { st.raf = 0; st.last = 0; setRest(st.m.a); return; }
    st.raf = requestAnimationFrame(frame);
  }
  function run() { const st = s.current; if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame(frame); } }
  function halt() { const st = s.current; cancelAnimationFrame(st.raf); st.raf = 0; }

  /** Springs to detent `i` (instantly under reduced motion). */
  function goTo(i: number, commit = true) {
    const st = s.current;
    i = Math.max(0, Math.min(st.angles.length - 1, i));
    st.m.phase = "snap";
    st.m.target = i;
    pick(i, commit);
    if (reduced()) { halt(); st.m.a = st.angles[i]; st.m.v = 0; paint(st.m.a); setRest(st.m.a); return; }
    run();
  }
  /** Where a step should start from: the destination if the knob is already heading somewhere. */
  const base = () => (s.current.raf && s.current.m.phase === "snap" ? s.current.m.target : s.current.sel);

  // Follow switches made elsewhere (T, Undo, data-theme-go, the agent) unless the visitor is mid-turn.
  useEffect(() => {
    const st = s.current;
    if (st.drag || st.commit) return;
    if (st.sent && st.sent !== st.looks[curIdx]?.id && performance.now() - st.sentAt < 2000) return; // ours still landing
    if (st.sel !== curIdx) goTo(curIdx, false);
  }, [curIdx]); // eslint-disable-line react-hooks/exhaustive-deps -- goTo only touches refs

  // Wheel steps one detent per notch (trackpads accumulate). React's onWheel is passive, so bind it here.
  /** Wheel: one detent per notch; trackpads accumulate small deltas. */
  function wheelStep(e: WheelEvent) {
    e.preventDefault();
    const st = s.current;
    st.wheel += e.deltaMode ? e.deltaY * 40 : e.deltaY;
    if (Math.abs(st.wheel) < 30) return;
    const dir = Math.sign(st.wheel);
    st.wheel = 0;
    goTo(base() + dir);
  }
  // React's onWheel is passive, so bind it here.
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    el.addEventListener("wheel", wheelStep, { passive: false });
    return () => el.removeEventListener("wheel", wheelStep);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- wheelStep only touches refs

  // While open: close on a tap outside or once the mouse wanders off, and keep working during a sweep. While a
  // view transition runs Chrome hit-tests every event to <html> (that was the old dial's lock), so events that
  // land there are routed to the control under the pointer by geometry.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const unit = unitRef.current!;
    const plate = unit.querySelector(".sw-plate")!;
    const inside = (el: Element, x: number, y: number, pad = 0) => {
      const r = el.getBoundingClientRect();
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    };
    const under = (x: number, y: number) => [...unit.querySelectorAll<HTMLElement>(".sw-lever, .sw-lamp, .sw-jewel, .sw-knob")]
      .find((el) => inside(el, x, y, el.classList.contains("sw-jewel") ? 4 : 0));
    const onDown = (e: globalThis.PointerEvent) => {
      const swept = e.target === html;
      const el = swept ? under(e.clientX, e.clientY) : undefined;
      if (el) e.preventDefault(); // keep focus where it is: <html> taking it would blur the unit shut
      if (el?.classList.contains("sw-knob")) { grab(el, e); return; }
      if (swept ? !inside(plate, e.clientX, e.clientY) : !unit.contains(e.target as Node)) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (e.target !== html) return;
      const el = under(e.clientX, e.clientY);
      if (!el || el.classList.contains("sw-knob")) return;
      e.preventDefault();
      el.click();
    };
    const onWheel = (e: WheelEvent) => { if (e.target === html && inside(dialRef.current!, e.clientX, e.clientY)) wheelStep(e); };
    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const st = s.current;
      if (inside(plate, e.clientX, e.clientY, 24)) { clearTimeout(st.closer); st.closer = 0; return; }
      if (st.closer) return;
      st.closer = window.setTimeout(() => {
        st.closer = 0;
        if (!st.drag && !unit.querySelector(":focus-visible")) setOpen(false);
      }, 380); // a beat, so a slightly-off pointer doesn't slam it shut
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("pointermove", onMove);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- grab/wheelStep only touch refs

  useEffect(() => () => { halt(); clearTimeout(s.current.commit); clearTimeout(s.current.closer); }, []);

  /** Pointer angle around the knob centre, 0° = up, clockwise. */
  const angleOf = (d: Drag, x: number, y: number) => (Math.atan2(x - d.cx, d.cy - y) * 180) / Math.PI;

  /** Takes hold of the knob: the pointer is captured, so the drag survives a sweep starting underneath it. */
  function grab(knob: HTMLElement, e: { pointerId: number; clientX: number; clientY: number; timeStamp: number }) {
    const r = knob.getBoundingClientRect();
    const st = s.current;
    halt();
    const d: Drag = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2, phi: 0, raw: st.m.a, start: st.m.a, moved: false, trail: [[e.timeStamp, st.m.a]] };
    d.phi = angleOf(d, e.clientX, e.clientY);
    st.drag = d;
    try { knob.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  }
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!open && e.pointerType !== "mouse") { setOpen(true); return; } // first tap only opens
    grab(e.currentTarget, e);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const st = s.current, d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    const phi = angleOf(d, e.clientX, e.clientY);
    d.raw += wrap(phi - d.phi);
    d.phi = phi;
    if (Math.abs(d.raw - d.start) > 2) d.moved = true;
    d.trail.push([e.timeStamp, d.raw]);
    while (d.trail.length > 2 && e.timeStamp - d.trail[0][0] > 90) d.trail.shift();
    st.m.a = shaped(st.angles, d.raw);
    paint(st.m.a);
    pick(nearest(st.angles, st.m.a));
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const st = s.current, d = st.drag;
    if (!d || d.id !== e.pointerId) return;
    st.drag = null;
    const [t0, r0] = d.trail[0];
    const dt = e.timeStamp - t0;
    const v = d.moved && dt > 0 && e.type === "pointerup" ? (d.raw - r0) / dt : 0;
    if (reduced() || Math.abs(v) < 0.1) { goTo(nearest(st.angles, st.m.a)); return; } // no fling: settle into the notch
    st.m.v = Math.max(-2.4, Math.min(2.4, v));
    st.m.phase = "coast";
    run();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const n = s.current.angles.length;
    const k = e.key;
    const to = k === "ArrowRight" || k === "ArrowUp" ? base() + 1
      : k === "ArrowLeft" || k === "ArrowDown" ? base() - 1
      : k === "PageUp" ? base() + 5 : k === "PageDown" ? base() - 5
      : k === "Home" ? 0 : k === "End" ? n - 1 : null;
    if (k === "Escape") { setOpen(false); (e.target as HTMLElement).blur(); return; }
    if (to === null) return;
    e.preventDefault();
    goTo(to);
  };

  // Hover opens; the open effect above closes it once the mouse wanders off.
  const enter = (e: PointerEvent) => { if (e.pointerType === "mouse") setOpen(true); };

  if (looks.length < 2) return null;
  const tint = looks[sel] ?? looks[0];
  const shown = looks[peek ?? sel] ?? tint;
  const shownIdx = peek ?? sel;
  const style = { "--sw-bg": tint.bg, "--sw-fg": tint.fg, "--sw-ac": tint.ac } as CSSProperties;

  return (
    <div
      ref={unitRef}
      className="theme-dial-aside sw" // theme-dial-aside: the view-transition layer + hooks other modules key on
      data-open={open || undefined}
      role="group"
      aria-label="Look and performance"
      style={style}
      onPointerEnter={enter}
      onFocus={() => setOpen(true)}
      // Tabbing away closes; focus dropping to nothing (a click elsewhere) is the pointer logic's call.
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <div className="sw-plate" aria-hidden="true" />
      <div ref={dialRef} className="sw-dial">
        <div className="sw-well" aria-hidden="true" />
        <svg className="sw-ticks" viewBox="0 0 132 132" aria-hidden="true">
          {angles.map((a, i) => (
            <line key={i} x1={CENTER} y1={CENTER - 45} x2={CENTER} y2={CENTER - (looks[i].design ? 51 : 49)} transform={`rotate(${a} ${CENTER} ${CENTER})`} />
          ))}
        </svg>
        {looks.map((l, i) => {
          const rad = (angles[i] * Math.PI) / 180;
          return (
            <button
              key={l.id}
              type="button"
              tabIndex={-1}
              className={`sw-jewel${l.design ? " is-design" : ""}${i === sel ? " is-on" : ""}`}
              aria-label={`Switch to ${l.name}`}
              style={{ transform: `translate(${(RING * Math.sin(rad)).toFixed(2)}px, ${(-RING * Math.cos(rad)).toFixed(2)}px)`, "--j-bg": l.bg, "--j-ac": l.ac } as CSSProperties}
              onClick={() => goTo(i)}
              onPointerEnter={() => setPeek(i)}
              onPointerLeave={() => setPeek(null)}
            />
          );
        })}
        <div
          ref={knobRef}
          className="sw-knob"
          role="slider"
          tabIndex={0}
          aria-label="Look"
          aria-valuemin={1}
          aria-valuemax={looks.length}
          aria-valuenow={sel + 1}
          aria-valuetext={`${tint.name}, ${tint.design ? "design" : "palette"}`}
          aria-orientation="horizontal"
          style={{ "--a": `${rest}deg` } as CSSProperties}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
        >
          <span className="sw-skirt" />
          <span className="sw-cap" />
          <span className="sw-ptr" />
        </div>
      </div>
      {/* after the dial so Tab runs knob → lever → lamp */}
      <div className="sw-side">
        <div className="sw-lcd" aria-hidden="true">
          <span className="sw-lcd-k">{shown.design ? "design" : "palette"} {String(shownIdx + 1).padStart(2, "0")}/{looks.length}</span>
          <span className="sw-lcd-v" style={{ fontFamily: shown.font }}>{shown.name}</span>
        </div>
        <div className="sw-row">
          <button
            type="button"
            className="sw-lever"
            role="switch"
            aria-checked={lite}
            aria-label="Performance mode"
            title={lite ? "Performance mode on: effects rest" : "Performance mode: effects rest, the design stays"}
            onClick={() => { setLite(!lite); toast(lite ? "Full effects back on" : "Performance mode on. Effects rest, the design stays."); }}
          >
            <span className="sw-slot"><span className="sw-bat" /></span>
          </button>
          <StatusDot />
        </div>
      </div>
    </div>
  );
}
