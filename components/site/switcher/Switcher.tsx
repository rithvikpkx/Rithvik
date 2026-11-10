"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { useDesign } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import StatusDot from "../StatusDot";
import { atRest, collide, magnet, nearestWithin, ringSlots, squash, stepOrb, type Orb, type Target, type Vec } from "./physics";
import "./switcher.css";

const SETTLE_MS = 190; // a pick must hold this long before it commits, so a fast run of picks switches once
const W = 236, H = 268; // the unit's box, px
const C: Vec = { x: 118, y: 150 }; // the nucleus when open
const CORNER: Vec = { x: 24, y: H - 26 }; // the nucleus when collapsed (the box's bottom-left)
const R_IN = 70, R_OUT = 100; // design ring, palette ring
const BASE = 28; // orb element radius (56px box); every size below is a scale of it
const S_NUC = 1, S_NUC_CLOSED = 0.8, S_DES = 0.36, S_PAL = 0.25;
const MAGNET = 58, SNAP = 34; // an orb dragged within MAGNET is pulled in; released within SNAP it takes the nucleus

type Look = { id: string; name: string; design: boolean; bg: string; fg: string; ac: string; font?: string };
type Drag = { pid: number; i: number; ox: number; oy: number; x: number; y: number; vx: number; vy: number; t: number; sx: number; sy: number; moved: boolean };
type St = {
  orbs: Orb[]; raf: number; last: number; open: boolean; sel: number; held: number; drag: Drag | null;
  commit: number; closer: number; wheel: number; sent: string; sentAt: number; nD: number; slots: Vec[];
  looks: Look[]; current: string; setDesign: (id: string) => void;
};

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Where orb `i` wants to be: the selected one is the nucleus, the rest sit in their ring slot (open) or fold
 *  into the corner (collapsed). The held orb's scale grows; its position is the pointer's. */
function targetOf(st: St, i: number): Target {
  if (i === st.sel) return st.open ? { ...C, s: S_NUC } : { ...CORNER, s: S_NUC_CLOSED };
  if (!st.open) return { ...CORNER, s: 0 };
  return { ...st.slots[i], s: (i < st.nD ? S_DES : S_PAL) * (i === st.held ? 1.7 : 1) };
}

/** The look switcher: a cluster of marbles, one per look, around a socket. The current look sits in the socket
 *  as the nucleus; the rest orbit it (designs inner, palettes outer). Pull an orb in (or tap it, or arrow to it)
 *  and it swaps with the nucleus, squashing as it lands. A hollow bead holds performance mode (`html.lite`) and
 *  a small lamp links to /status. Collapsed to the bare nucleus until hovered, focused or tapped. Picking never
 *  waits on the page: the swap is immediate and the look commits once the pick has rested for SETTLE_MS. */
export default function Switcher() {
  const { entries, current, setDesign } = useDesign();
  const { lite, setLite, toast } = useSite();

  const looks = useMemo<Look[]>(() => entries.map((e) => e.kind === "design"
    ? { id: e.id, name: e.meta.name, design: true, bg: e.meta.swatch[0], fg: e.meta.swatch[1], ac: e.meta.swatch[2], font: e.meta.cardFont }
    : { id: e.id, name: e.name, design: false, bg: e.swatch[0], fg: e.swatch[1], ac: e.swatch[2] }), [entries]);
  const nD = looks.filter((l) => l.design).length;
  const slots = useMemo(() => ringSlots(nD, looks.length - nD, C, R_IN, R_OUT), [nD, looks.length]);
  const curIdx = Math.max(0, looks.findIndex((l) => l.id === current));

  const [sel, setSel] = useState(curIdx);
  const [open, setOpenState] = useState(false);
  const [peek, setPeek] = useState<number | null>(null); // hovered / held orb, named in the label
  const [note, setNote] = useState(false); // the label shows the bead's state while it is hovered or focused
  const [pulse, setPulse] = useState(0); // remounts the snap ring, replaying its animation

  const unitRef = useRef<HTMLDivElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  // Mutable state for the rAF loop and the once-bound listeners (never read during render).
  const s = useRef<St>({
    orbs: [], raf: 0, last: 0, open: false, sel: curIdx, held: -1, drag: null, commit: 0, closer: 0, wheel: 0,
    sent: "", sentAt: 0, nD, slots, looks, current, setDesign,
  });
  useEffect(() => { Object.assign(s.current, { nD, slots, looks, current, setDesign }); });

  /** Writes orb `i` to the DOM (position, squash along its velocity, scale): no React render per frame. */
  function paint(i: number) {
    const o = s.current.orbs[i], el = els.current[i];
    if (!o || !el) return;
    const q = reduced() ? { rot: 0, sx: 1, sy: 1 } : squash(o.vx, o.vy);
    const k = Math.max(0, o.s);
    el.style.transform = `translate3d(${o.x.toFixed(2)}px,${o.y.toFixed(2)}px,0) rotate(${q.rot.toFixed(3)}rad) scale(${(k * q.sx).toFixed(3)},${(k * q.sy).toFixed(3)})`;
  }

  /** One animation frame: spring every orb to its target, let them jostle, paint. Stops itself when all rest. */
  function frame(t: number) {
    const st = s.current;
    const dt = st.last ? t - st.last : 16;
    st.last = t;
    st.orbs.forEach((o, i) => {
      const tg = targetOf(st, i);
      if (i === st.held && st.drag) { // the pointer owns its position; only the scale springs
        const d = st.drag;
        stepOrb(o, { x: o.x, y: o.y, s: tg.s }, dt);
        o.x = d.x; o.y = d.y; o.vx = d.vx; o.vy = d.vy;
      } else stepOrb(o, tg, dt);
    });
    if (st.open) collide(st.orbs, st.orbs.map(() => BASE), (i) => i === st.held || i === st.sel);
    st.orbs.forEach((_, i) => paint(i));
    if (st.held < 0 && st.orbs.every((o, i) => atRest(o, targetOf(st, i)))) { st.raf = 0; st.last = 0; return; }
    st.raf = requestAnimationFrame(frame);
  }
  /** Starts the loop (or, under reduced motion, jumps every orb to its target). */
  function run() {
    const st = s.current;
    if (reduced()) {
      st.orbs.forEach((o, i) => { Object.assign(o, targetOf(st, i), { vx: 0, vy: 0, vs: 0 }); paint(i); });
      return;
    }
    if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame(frame); }
  }

  // (Re)build the orbs when the set of looks changes; they start folded into the corner and spring out to place.
  useEffect(() => {
    const st = s.current;
    st.orbs = looks.map((_, i) => st.orbs[i] ?? { x: CORNER.x, y: CORNER.y, vx: 0, vy: 0, s: 0, vs: 0 });
    run();
    return () => { cancelAnimationFrame(st.raf); st.raf = 0; clearTimeout(st.commit); clearTimeout(st.closer); };
  }, [looks.length]); // eslint-disable-line react-hooks/exhaustive-deps -- run/paint only touch refs

  /** Opens or folds the unit; the orbs follow by spring. */
  function setOpen(v: boolean) {
    const st = s.current;
    if (st.open === v) return;
    st.open = v;
    setOpenState(v);
    if (!v) { setPeek(null); setNote(false); }
    run();
  }

  /** Makes look `i` the nucleus now; the look itself commits after it has rested for SETTLE_MS. */
  function pick(i: number, commit = true) {
    const st = s.current;
    i = (i + st.looks.length) % st.looks.length;
    if (i === st.sel) return;
    st.sel = i;
    setSel(i);
    setPulse((p) => p + 1);
    clearTimeout(st.commit);
    st.commit = 0;
    run();
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

  // Follow switches made elsewhere (T, Undo, data-theme-go, the agent) unless the visitor is mid-pick.
  useEffect(() => {
    const st = s.current;
    if (st.drag || st.commit) return;
    if (st.sent && st.sent !== st.looks[curIdx]?.id && performance.now() - st.sentAt < 2000) return; // ours still landing
    if (st.sel !== curIdx) pick(curIdx, false);
  }, [curIdx]); // eslint-disable-line react-hooks/exhaustive-deps -- pick only touches refs and setters

  /** Takes hold of orb `i`: the pointer is captured, so the drag survives a sweep starting underneath it. */
  function grab(i: number, el: HTMLElement, e: { pointerId: number; clientX: number; clientY: number; timeStamp: number }) {
    const st = s.current, o = st.orbs[i], r = unitRef.current!.getBoundingClientRect();
    if (!o) return;
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    st.drag = { pid: e.pointerId, i, ox: o.x - sx, oy: o.y - sy, x: o.x, y: o.y, vx: 0, vy: 0, t: e.timeStamp, sx, sy, moved: false };
    st.held = i;
    setPeek(i);
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    run();
  }
  const down = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!s.current.open) { setOpen(true); if (e.pointerType !== "mouse") return; } // a first tap only opens
    grab(i, e.currentTarget, e);
  };
  const move = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const st = s.current, d = st.drag;
    if (!d || d.pid !== e.pointerId || d.i !== i) return;
    const r = unitRef.current!.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (Math.hypot(px - d.sx, py - d.sy) > 4) d.moved = true;
    if (!d.moved) return;
    const p = i === st.sel ? { x: px + d.ox, y: py + d.oy } : magnet({ x: px + d.ox, y: py + d.oy }, C, MAGNET);
    const dt = Math.max(1, e.timeStamp - d.t);
    d.vx = 0.5 * d.vx + 0.5 * Math.max(-2.4, Math.min(2.4, (p.x - d.x) / dt));
    d.vy = 0.5 * d.vy + 0.5 * Math.max(-2.4, Math.min(2.4, (p.y - d.y) / dt));
    d.t = e.timeStamp; d.x = p.x; d.y = p.y;
    const o = st.orbs[i];
    o.x = p.x; o.y = p.y; o.vx = d.vx; o.vy = d.vy;
    paint(i);
    unitRef.current!.toggleAttribute("data-hot", i !== st.sel && Math.hypot(p.x - C.x, p.y - C.y) < SNAP);
  };
  const up = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    const st = s.current, d = st.drag;
    if (!d || d.pid !== e.pointerId || d.i !== i) return;
    st.drag = null;
    st.held = -1;
    unitRef.current!.removeAttribute("data-hot");
    setPeek(null);
    const took = e.type === "pointerup" && (!d.moved || Math.hypot(d.x - C.x, d.y - C.y) < SNAP);
    if (!took) { st.orbs[i].vx = d.vx; st.orbs[i].vy = d.vy; } // let go: it carries its speed back to its slot
    if (took) pick(i);
    run();
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const st = s.current, k = e.key, n = st.looks.length;
    const to = k === "ArrowRight" || k === "ArrowDown" ? st.sel + 1 : k === "ArrowLeft" || k === "ArrowUp" ? st.sel - 1
      : k === "Home" ? 0 : k === "End" ? n - 1 : null;
    if (k === "Escape") { setOpen(false); (e.target as HTMLElement).blur(); return; }
    if (to === null) return;
    e.preventDefault();
    const i = (to + n) % n;
    pick(i);
    els.current[i]?.focus({ preventScroll: true }); // roving focus follows the nucleus
  };

  // While open: close on a tap outside or once the mouse wanders off, step on wheel, and keep working during a sweep.
  // During a view transition Chrome hit-tests every event to <html> (the old dial's lock), so events that land there
  // are routed to the control under the pointer by geometry.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const unit = unitRef.current!;
    const inside = (r: DOMRect, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    const hit = (x: number, y: number): { orb: number } | { el: HTMLElement } | null => {
      const r = unit.getBoundingClientRect(), st = s.current;
      const i = nearestWithin(st.orbs.map((o) => ({ x: r.left + o.x, y: r.top + o.y })), { x, y }, (k) => Math.max(BASE * st.orbs[k].s + 4, 13));
      if (i >= 0) return { orb: i };
      const el = [...unit.querySelectorAll<HTMLElement>(".sw-calm, .sw-lamp")].find((b) => inside(b.getBoundingClientRect(), x, y, 3));
      return el ? { el } : null;
    };
    const onDown = (e: globalThis.PointerEvent) => {
      const swept = e.target === html;
      const h = swept ? hit(e.clientX, e.clientY) : null;
      if (h) {
        e.preventDefault(); // keep focus where it is: <html> taking it would blur the unit shut
        if ("orb" in h) grab(h.orb, els.current[h.orb]!, e);
        return;
      }
      if (swept ? !inside(unit.getBoundingClientRect(), e.clientX, e.clientY) : !unit.contains(e.target as Node)) setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (e.target !== html) return;
      const h = hit(e.clientX, e.clientY);
      if (h && "el" in h) { e.preventDefault(); h.el.click(); }
    };
    const onWheel = (e: WheelEvent) => {
      const r = unit.getBoundingClientRect();
      if (Math.hypot(e.clientX - r.left - C.x, e.clientY - r.top - C.y) > R_OUT + 12 || !(e.target === html || unit.contains(e.target as Node))) return;
      e.preventDefault();
      const st = s.current;
      st.wheel += e.deltaMode ? e.deltaY * 40 : e.deltaY;
      if (Math.abs(st.wheel) < 30) return; // trackpads accumulate small deltas
      pick(st.sel + Math.sign(st.wheel));
      st.wheel = 0;
    };
    const onMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const st = s.current;
      if (inside(unit.getBoundingClientRect(), e.clientX, e.clientY, 24)) { clearTimeout(st.closer); st.closer = 0; return; }
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
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- grab/pick/setOpen only touch refs and setters

  if (looks.length < 2) return null;
  const tint = looks[sel] ?? looks[0];
  const shownIdx = peek ?? sel;
  const shown = looks[shownIdx] ?? tint;
  const style = { "--sw-bg": tint.bg, "--sw-fg": tint.fg, "--sw-ac": tint.ac, "--w": `${W}px`, "--h": `${H}px` } as CSSProperties;

  return (
    <div
      ref={unitRef}
      className="theme-dial-aside sw" // theme-dial-aside: the view-transition layer + hooks other modules key on
      data-open={open || undefined}
      role="group"
      aria-label="Look and performance"
      style={style}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }} // hover opens; the effect above closes it again
      onFocus={() => setOpen(true)}
      // Tabbing away closes; focus dropping to nothing (a click elsewhere) is the pointer logic's call.
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
    >
      <div className="sw-field" aria-hidden="true">
        <svg viewBox="0 0 232 232">
          <circle cx="116" cy="116" r={R_IN} />
          <circle cx="116" cy="116" r={R_OUT} />
        </svg>
        <span className="sw-socket" />
        {pulse > 0 && <span key={pulse} className="sw-pulse" />}
      </div>
      <div className="sw-label" aria-hidden="true">
        {note ? <b>{`Performance mode ${lite ? "on" : "off"}`}</b> : <><b style={{ fontFamily: shown.font }}>{shown.name}</b><span>{shown.design ? "design" : "palette"} {String(shownIdx + 1).padStart(2, "0")}/{looks.length}</span></>}
      </div>
      <div className="sw-orbs" role="radiogroup" aria-label="Look" onKeyDown={onKey}>
        {looks.map((l, i) => (
          <button
            key={l.id}
            ref={(el) => { els.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={i === sel}
            aria-label={`${l.name}, ${l.design ? "design" : "palette"}`}
            tabIndex={i === sel ? 0 : -1}
            className={`sw-orb${l.design ? " is-design" : ""}${i === sel ? " is-sel" : ""}${i === peek && i !== sel ? " is-held" : ""}`}
            style={{ "--o-bg": l.bg, "--o-ac": l.ac, "--o-fg": l.fg } as CSSProperties}
            onPointerDown={down(i)}
            onPointerMove={move(i)}
            onPointerUp={up(i)}
            onPointerCancel={up(i)}
            onPointerEnter={(e) => { if (e.pointerType === "mouse" && !s.current.drag) setPeek(i); }}
            onPointerLeave={() => { if (!s.current.drag) setPeek(null); }}
            onClick={(e) => { if (e.detail === 0) pick(i); }} // Enter/Space; pointer picks are made on pointerup
          >
            <span className="sw-face" />
          </button>
        ))}
      </div>
      {/* after the orbs so Tab runs nucleus → bead → lamp */}
      <button
        type="button"
        className="sw-calm"
        role="switch"
        aria-checked={lite}
        aria-label="Performance mode"
        title={lite ? "Performance mode on: effects rest" : "Performance mode: effects rest, the design stays"}
        onClick={() => { setLite(!lite); toast(lite ? "Full effects back on" : "Performance mode on. Effects rest, the design stays."); }}
        onPointerEnter={() => setNote(true)}
        onPointerLeave={() => setNote(false)}
        onFocus={() => setNote(true)}
        onBlur={() => setNote(false)}
      ><i /></button>
      <StatusDot />
    </div>
  );
}
