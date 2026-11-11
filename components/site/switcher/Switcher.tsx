"use client";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useDesign } from "../DesignProvider";
import { useSite } from "../SiteProvider";
import StatusDot from "../StatusDot";
import { CAP_W, MAX_W, PITCH, centerScroll, clamp, edgeVelocity, nearestIndex, revealScroll, step, stripLayout, stripeScale, thumb, type Layout, type Spring } from "./strip";
import "./switcher.css";

const SETTLE_MS = 190; // a pick must hold this long before it commits, so a fast run of picks switches once
const H = 64, TY = 28; // the open capsule's height and the strip's centre line
const PUCK = 52; // the collapsed puck
const LR = 23, M = 2.6; // lens radius and magnification
const EDGE = 26, EDGE_V = 420; // the auto-scroll zone at each end of the strip (px) and its top speed (px/s)
const SCREEN_PAD = 24; // the capsule leaves this much of the screen width free
const CLOSED = { x: PUCK / 2, y: H - PUCK / 2 }; // the lens centre while collapsed (surf coordinates: the surf is H tall, bottom-anchored)

type Look = { id: string; name: string; design: boolean; bg: string; fg: string; ac: string; font?: string };
type Drag = { pid: number; x0: number; sc0: number; moved: boolean; touch: boolean };
type Note = { kind: "calm" | "lamp"; sub: string };
type St = {
  raf: number; last: number; open: boolean; sel: number; focus: number; hover: number;
  ptr: number | null; // the pointer's x inside the strip window while it hovers
  sc: Spring; scT: number; lx: Spring; ly: Spring; o: Spring; fs: Spring; edge: number; drag: Drag | null;
  commit: number; closer: number; sent: string; sentAt: number; wantFocus: boolean;
  looks: Look[]; lay: Layout; current: string; setDesign: (id: string) => void; lite: boolean;
  ticks: HTMLElement[]; tk: string[]; fl: boolean; fr: boolean;
};

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const subscribeW = (cb: () => void) => { addEventListener("resize", cb); return () => removeEventListener("resize", cb); };

/** The look picker ("Meniscus"): a glass puck bottom-left that opens into a capsule holding one two-tone stripe per
 *  look (designs, then palettes). A lens rides the strip after the pointer on springs and magnifies what is under it;
 *  tapping swallows that look into the lens and the page switches. At most VISIBLE looks show at once; past that the
 *  strip scrolls (wheel, drag, edge hover, arrow keys). Performance mode (`html.lite`) and the /status lamp are the
 *  capsule's end caps. Picking never waits on the page: the pick is immediate and the look commits after SETTLE_MS. */
export default function Switcher() {
  const { entries, current, setDesign } = useDesign();
  const { lite, setLite, toast } = useSite();

  const looks = useMemo<Look[]>(() => entries.map((e) => e.kind === "design"
    ? { id: e.id, name: e.meta.name, design: true, bg: e.meta.swatch[0], fg: e.meta.swatch[1], ac: e.meta.swatch[2], font: e.meta.cardFont }
    : { id: e.id, name: e.name, design: false, bg: e.swatch[0], fg: e.swatch[1], ac: e.swatch[2] }), [entries]);
  const n = looks.length, nd = looks.filter((l) => l.design).length;
  const winW = useSyncExternalStore(subscribeW, () => innerWidth, () => MAX_W + SCREEN_PAD);
  const lay = useMemo(() => stripLayout(n, nd, Math.min(MAX_W, winW - SCREEN_PAD)), [n, nd, winW]);
  const curIdx = Math.max(0, looks.findIndex((l) => l.id === current));

  const [sel, setSel] = useState(curIdx); // the look in the lens (may be ahead of `current` for SETTLE_MS)
  const [open, setOpenState] = useState(false);
  const [hover, setHover] = useState(-1); // the look under the pointer
  const [focusIdx, setFocusIdx] = useState(-1); // the keyboard-focused look
  const [kbd, setKbd] = useState(false); // focus came from the keyboard: the lens shows a ring
  const [note, setNote] = useState<Note | null>(null); // the peek names an end cap while it is hovered or focused

  const unitRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const magRef = useRef<HTMLDivElement>(null);
  const mrowRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLElement>(null);
  const els = useRef<(HTMLButtonElement | null)[]>([]);
  // Mutable state for the rAF loop and the once-bound listeners (never read during render).
  const s = useRef<St>({
    raf: 0, last: 0, open: false, sel: curIdx, focus: -1, hover: -1, ptr: null,
    sc: { x: 0, v: 0 }, scT: 0, lx: { x: CLOSED.x, v: 0 }, ly: { x: CLOSED.y, v: 0 }, o: { x: 0, v: 0 }, fs: { x: 1, v: 0 }, edge: 0, drag: null,
    commit: 0, closer: 0, sent: "", sentAt: 0, wantFocus: false,
    looks, lay, current, setDesign, lite, ticks: [], tk: [], fl: false, fr: false,
  });
  useEffect(() => { Object.assign(s.current, { looks, lay, current, setDesign, lite }); });

  /** Where every spring is heading: the lens follows the pointer (or the focused / selected stripe), the capsule's
   *  contents fade in with `o`, and the lens swaps its magnified view for the look it holds (`fs`) when idle. */
  function aim() {
    const st = s.current, L = st.lay, idx = st.focus >= 0 ? st.focus : st.sel;
    const previewing = st.ptr !== null || st.focus >= 0;
    const vx = st.ptr !== null ? clamp(st.ptr, 0, L.vw) : clamp((L.xs[idx] ?? 0) - st.sc.x, 0, L.vw);
    return { lx: st.open ? CAP_W + vx : CLOSED.x, ly: st.open ? TY : CLOSED.y, o: st.open ? 1 : 0, fs: st.open && previewing ? 0 : 1 };
  }

  /** Writes the springs to the DOM (transforms only): the lens, its magnified copy, the scrolled rows, the stripes' heights. */
  function paint() {
    const st = s.current, L = st.lay, sc = st.sc.x, lens = lensRef.current;
    if (!lens) return;
    const sx = st.lite || reduced() ? 1 : 1 + Math.min(0.32, Math.abs(st.lx.v) / 1300), sy = 1 / Math.sqrt(sx);
    lens.style.transform = `translate(${(st.lx.x - LR).toFixed(2)}px,${(st.ly.x - LR).toFixed(2)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    magRef.current!.style.transform = `translate(${(LR - st.lx.x * M).toFixed(2)}px,${(LR - st.ly.x * M).toFixed(2)}px) scale(${M})`;
    mrowRef.current!.style.transform = `translateX(${(CAP_W - sc).toFixed(2)}px)`;
    rowRef.current!.style.transform = `translateX(${(-sc).toFixed(2)}px)`;
    fillRef.current!.style.transform = `scale(${clamp(st.fs.x, 0, 1.2).toFixed(3)})`;
    const lvx = st.lx.x - CAP_W;
    for (let i = 0; i < st.ticks.length; i++) {
      const v = `scaleY(${stripeScale(L.xs[i] - sc - lvx, st.o.x).toFixed(3)})`;
      if (st.tk[i] !== v) { st.tk[i] = v; st.ticks[i].style.transform = v; }
    }
    const fl = sc > 0.5, fr = sc < L.max - 0.5;
    if (fl !== st.fl) { st.fl = fl; vpRef.current!.toggleAttribute("data-fl", fl); }
    if (fr !== st.fr) { st.fr = fr; vpRef.current!.toggleAttribute("data-fr", fr); }
    if (thumbRef.current) thumbRef.current.style.transform = `translateX(${thumb(sc, L.vw, L.contentW).left.toFixed(2)}px)`;
  }

  /** Advances every spring by dt seconds; true once all are at rest. Under reduced motion they jump to their targets. */
  function advance(dt: number): boolean {
    const st = s.current, a = aim();
    if (reduced()) {
      st.sc.x = st.scT; st.sc.v = 0;
      Object.assign(st.lx, { x: a.lx, v: 0 }); Object.assign(st.ly, { x: a.ly, v: 0 }); Object.assign(st.o, { x: a.o, v: 0 }); Object.assign(st.fs, { x: a.fs, v: 0 });
      return true;
    }
    const k = st.lite ? 260 : 150, c = st.lite ? 34 : 16, dragging = !!st.drag?.moved;
    return [
      step(st.sc, st.scT, dragging ? 600 : 190, dragging ? 45 : 26, dt),
      step(st.lx, a.lx, k, c, dt), step(st.ly, a.ly, 200, 26, dt), step(st.o, a.o, 170, 24, dt), step(st.fs, a.fs, 220, 22, dt),
    ].every(Boolean);
  }

  /** The look under the strip-window x `x`, mirrored into state only when it changes (that is what the peek names). */
  function track(x: number) {
    const st = s.current, h = nearestIndex(st.lay.xs, x + st.sc.x);
    if (h !== st.hover) { st.hover = h; setHover(h); }
  }

  /** One animation frame: edge auto-scroll, springs, paint. Stops itself once everything rests. */
  function frame(t: number) {
    const st = s.current, dt = st.last ? Math.min(0.032, (t - st.last) / 1000) : 0.016;
    st.last = t;
    if (st.edge) st.scT = clamp(st.scT + st.edge * dt, 0, st.lay.max);
    const rest = advance(dt);
    if (st.ptr !== null) track(st.ptr);
    paint();
    if (rest && !st.edge && !st.drag) {
      if (st.scT === Math.round(st.scT)) { st.raf = 0; st.last = 0; return; }
      st.scT = Math.round(st.scT); // come to rest on whole pixels so the stripes stay crisp
    }
    st.raf = requestAnimationFrame(frame);
  }
  /** Starts the loop (or, under reduced motion, jumps straight to the targets). */
  function run() {
    const st = s.current;
    if (reduced()) { st.edge = 0; st.scT = Math.round(st.scT); advance(0); paint(); return; }
    if (!st.raf) { st.last = 0; st.raf = requestAnimationFrame(frame); }
  }

  // The stripes' elements and the layout changed: re-collect them, keep the scroll in range, repaint.
  useEffect(() => {
    const st = s.current;
    st.ticks = [...rowRef.current!.querySelectorAll<HTMLElement>(".sw-st")];
    st.tk = [];
    st.scT = clamp(st.scT, 0, lay.max);
    st.sc.x = clamp(st.sc.x, 0, lay.max);
    run();
  }, [n, lay]); // eslint-disable-line react-hooks/exhaustive-deps -- run/paint only touch refs
  useEffect(() => { // unmount only: a relayout must not drop a pending commit
    const st = s.current;
    return () => { cancelAnimationFrame(st.raf); st.raf = 0; clearTimeout(st.commit); clearTimeout(st.closer); };
  }, []);

  /** Opens or folds the capsule; the lens, the strip and the caps follow by spring. Opening scrolls the current look into view. */
  function setOpen(v: boolean) {
    const st = s.current;
    if (st.open === v) return;
    st.open = v;
    setOpenState(v);
    if (v) { st.scT = centerScroll(st.lay.xs[st.sel] ?? 0, st.lay.vw, st.lay.max); st.sc.x = st.scT; st.sc.v = 0; }
    else { st.ptr = null; st.edge = 0; st.drag = null; st.hover = -1; setHover(-1); setNote(null); }
    run();
  }
  useEffect(() => { // a keyboard open lands on the current look
    const st = s.current;
    if (open && st.wantFocus) { st.wantFocus = false; els.current[st.sel]?.focus({ preventScroll: true }); }
  }, [open]);

  /** Makes look `i` the one in the lens now (it is swallowed into the lens); the page commits after SETTLE_MS of rest. */
  function pick(i: number, commit = true) {
    const st = s.current, len = st.looks.length;
    i = (i + len) % len;
    if (i === st.sel) return;
    st.sel = i;
    setSel(i);
    st.ptr = null; st.edge = 0; st.hover = -1; setHover(-1);
    st.fs.x = 0; st.fs.v = 0; // the lens empties and takes the new look back in
    if (st.open) st.scT = revealScroll(st.scT, st.lay.xs[i], st.lay.vw, PITCH * 2, st.lay.max);
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

  // Pointer, wheel and outside-tap handling lives on the document and works by geometry: during a view transition
  // Chrome hit-tests every event to <html> (the old dial's lock), so events that land there are routed to the strip
  // or the end caps by where they are. Strip gestures: hover moves the lens; press-and-release picks; a drag past 6px
  // (or the wheel, or hovering an end of the strip) scrolls.
  useEffect(() => {
    const html = document.documentElement, unit = unitRef.current!, vp = vpRef.current!;
    const inside = (r: DOMRect, x: number, y: number, pad = 0) => x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    const mine = (e: Event) => e.target === html || unit.contains(e.target as Node);
    const local = (e: { clientX: number }) => e.clientX - vp.getBoundingClientRect().left;
    const hoverAt = (x: number, edge: boolean) => {
      const st = s.current, L = st.lay;
      st.ptr = x;
      st.edge = edge && L.max > 0 && !reduced() ? edgeVelocity(x, L.vw, EDGE, EDGE_V, st.scT, L.max) : 0;
      track(x);
      run();
    };
    const leave = () => {
      const st = s.current;
      if (st.ptr === null && st.hover < 0) return;
      st.ptr = null; st.edge = 0; st.hover = -1; setHover(-1);
      run();
    };
    const cap = (x: number, y: number) => [...unit.querySelectorAll<HTMLElement>(".sw-calm, .sw-lamp")].find((b) => inside(b.getBoundingClientRect(), x, y, 3));

    const onDown = (e: PointerEvent) => {
      const st = s.current, swept = e.target === html;
      if (swept ? !inside(unit.getBoundingClientRect(), e.clientX, e.clientY) : !unit.contains(e.target as Node)) { setOpen(false); return; }
      if (!st.open) return; // a tap on the puck is handled by the puck
      const r = vp.getBoundingClientRect();
      if (inside(r, e.clientX, e.clientY)) {
        e.preventDefault(); // keep focus where it is: <html> taking it would blur the capsule shut
        const touch = e.pointerType !== "mouse";
        st.drag = { pid: e.pointerId, x0: e.clientX, sc0: st.scT, moved: false, touch };
        hoverAt(e.clientX - r.left, false); // touch: the lens shows what the finger is on
      } else if (swept && cap(e.clientX, e.clientY)) e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const st = s.current, d = st.drag;
      if (d && d.pid === e.pointerId) {
        if (!d.moved && Math.abs(e.clientX - d.x0) > 6) { d.moved = true; if (d.touch) leave(); }
        if (d.moved) { st.scT = clamp(d.sc0 - (e.clientX - d.x0), 0, st.lay.max); run(); }
        if (!d.touch || !d.moved) hoverAt(local(e), false); // a touch drag scrolls without a lens
        return;
      }
      if (e.pointerType !== "mouse" || !st.open) return;
      if (mine(e) && inside(vp.getBoundingClientRect(), e.clientX, e.clientY)) hoverAt(local(e), true);
      else leave();
      if (inside(unit.getBoundingClientRect(), e.clientX, e.clientY, 24)) { clearTimeout(st.closer); st.closer = 0; return; }
      if (st.closer) return;
      st.closer = window.setTimeout(() => {
        st.closer = 0;
        if (!st.drag && !unit.querySelector(":focus-visible")) setOpen(false);
      }, 380); // a beat, so a slightly-off pointer doesn't slam it shut
    };
    const onUp = (e: PointerEvent) => {
      const st = s.current, d = st.drag;
      if (!d || d.pid !== e.pointerId) return;
      st.drag = null;
      const x = local(e);
      if (e.type === "pointerup" && !d.moved && x >= 0 && x <= st.lay.vw) pick(nearestIndex(st.lay.xs, x + st.sc.x));
      if (d.touch) leave();
      run();
    };
    const onClick = (e: MouseEvent) => {
      if (e.target !== html) return;
      const b = cap(e.clientX, e.clientY);
      if (b) { e.preventDefault(); b.click(); }
    };
    const onWheel = (e: WheelEvent) => {
      const st = s.current, L = st.lay;
      if (!st.open || L.max <= 0 || !mine(e) || !inside(vp.getBoundingClientRect(), e.clientX, e.clientY)) return;
      const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * (e.deltaMode ? 40 : 1);
      const to = clamp(st.scT + d, 0, L.max);
      if (to === st.scT) return; // already at that end: let the page have it
      e.preventDefault();
      st.scT = to;
      run();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("wheel", onWheel, true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- handlers only touch refs and setters

  /** Arrow keys, Home/End and PageUp/PageDown move focus (the lens previews it and the strip scrolls to keep it in view); Enter picks. */
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const st = s.current, k = e.key, f = st.focus >= 0 ? st.focus : st.sel;
    const to = k === "ArrowRight" || k === "ArrowDown" ? f + 1 : k === "ArrowLeft" || k === "ArrowUp" ? f - 1
      : k === "Home" ? 0 : k === "End" ? n - 1 : k === "PageDown" ? f + 5 : k === "PageUp" ? f - 5 : null;
    if (to === null) return;
    e.preventDefault();
    els.current[clamp(to, 0, n - 1)]?.focus({ preventScroll: true });
  };
  /** Taking keyboard focus on a stripe previews it and scrolls it into view (a mouse press does neither). */
  function focusLook(i: number, el: HTMLElement) {
    const st = s.current;
    if (!el.matches(":focus-visible")) return;
    st.focus = i; setFocusIdx(i); setKbd(true);
    st.ptr = null; st.edge = 0;
    st.scT = revealScroll(st.scT, st.lay.xs[i], st.lay.vw, PITCH * 2.4, st.lay.max);
    run();
  }
  /** Names the end cap under the pointer or focus in the peek chip. */
  const noteOf = (t: EventTarget | null): Note | null => {
    const el = (t as Element | null)?.closest?.(".sw-calm, .sw-lamp");
    if (!el) return null;
    return el.classList.contains("sw-calm") ? { kind: "calm", sub: "" } : { kind: "lamp", sub: (el.getAttribute("aria-label") ?? "").replace(/^Status:?\s*/, "") || "not checked" };
  };

  if (n < 2) return null;
  const tint = looks[sel] ?? looks[0];
  const shownIdx = hover >= 0 ? hover : focusIdx >= 0 ? focusIdx : sel;
  const shown = looks[shownIdx] ?? tint;
  const pk = note
    ? { name: note.kind === "calm" ? "Performance mode" : "Status", sub: note.kind === "calm" ? (lite ? "on" : "off") : note.sub }
    : { name: shown.name, sub: `${shown.design ? "design" : "palette"} ${String(shownIdx + 1).padStart(2, "0")}/${n}` };
  const rovingIdx = focusIdx >= 0 ? focusIdx : sel;
  const groups: [string, number][] = nd > 0 && nd < n ? [["designs", 0], ["palettes", nd]] : [[nd > 0 ? "designs" : "palettes", 0]];
  const style = { "--cw": `${lay.capW}px`, "--vw": `${lay.vw}px`, "--cap": `${CAP_W}px`, "--content": `${lay.contentW}px` } as CSSProperties;

  return (
    <div
      ref={unitRef}
      className="theme-dial-aside sw" // theme-dial-aside: the view-transition layer + hooks other modules key on
      data-open={open || undefined}
      data-kbd={kbd || undefined}
      role="group"
      aria-label="Look and performance"
      style={style}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }} // hover opens; the document handler closes it again
      onFocus={() => setOpen(true)}
      // Tabbing away closes; focus dropping to nothing (a click elsewhere) is the pointer logic's call.
      onBlur={(e) => { if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); (e.target as HTMLElement).blur(); } }}
      onPointerOver={(e) => setNote(noteOf(e.target))}
      onPointerOut={() => setNote(null)}
    >
      <div className="sw-glass">
        <div className="sw-surf">
          <div className="sw-in">
            <div ref={vpRef} className="sw-vp">
              <div ref={rowRef} className="sw-row" role="radiogroup" aria-label="Look" onKeyDown={onKey} onMouseDown={(e) => e.preventDefault()}>
                {looks.map((l, i) => (
                  <button
                    key={l.id}
                    ref={(el) => { els.current[i] = el; }}
                    type="button"
                    role="radio"
                    aria-checked={i === sel}
                    aria-label={`${l.name}, ${l.design ? "design" : "palette"}`}
                    tabIndex={i === rovingIdx ? 0 : -1}
                    className="sw-b"
                    style={{ left: lay.xs[i] - PITCH / 2 - 0.5, width: PITCH + 1 }}
                    onClick={(e) => { if (e.detail === 0) pick(i); }} // Enter/Space; pointer picks are made on release
                    onFocus={(e) => focusLook(i, e.currentTarget)}
                    onBlur={(e) => { if (!(e.relatedTarget as Element | null)?.closest?.(".sw-row")) { s.current.focus = -1; setFocusIdx(-1); setKbd(false); run(); } }}
                  >
                    <i className="sw-st" style={{ "--b": l.bg, "--a": l.ac } as CSSProperties} />
                  </button>
                ))}
                {groups.map(([label, at]) => <span key={label} className="sw-lbl" aria-hidden="true" style={{ left: lay.xs[at] - 1.5 }}>{label}</span>)}
              </div>
            </div>
            {lay.max > 0 && <i className="sw-track" aria-hidden="true" style={{ left: CAP_W, width: lay.vw }}><b ref={thumbRef} style={{ width: thumb(0, lay.vw, lay.contentW).width }} /></i>}
            <StatusDot />
            <button
              type="button"
              className="sw-calm"
              role="switch"
              aria-checked={lite}
              aria-label="Performance mode"
              title={lite ? "Performance mode on: effects rest" : "Performance mode: effects rest, the design stays"}
              onClick={() => { setLite(!lite); toast(lite ? "Full effects back on" : "Performance mode on. Effects rest, the design stays."); }}
            >
              <svg viewBox="0 0 16 8" aria-hidden="true"><path className="wave" d="M1 4c2.3-3.6 4.7-3.6 7 0s4.7 3.6 7 0" /><path className="flat" d="M1 4h14" /></svg>
            </button>
          </div>
          <div ref={lensRef} className="sw-lens" aria-hidden="true">
            <div ref={magRef} className="sw-mag">
              <div ref={mrowRef} className="sw-mrow">
                {looks.map((l, i) => <i key={l.id} className="sw-mt" style={{ left: lay.xs[i] - 1.5, "--b": l.bg, "--a": l.ac } as CSSProperties} />)}
              </div>
            </div>
            <div ref={fillRef} className="sw-fill" style={{ "--b": tint.bg, "--a": tint.ac } as CSSProperties} />
          </div>
        </div>
      </div>
      <div className="sw-peek" data-sys={note ? "" : undefined} aria-hidden="true">
        <span className="sw-mini" style={{ "--b": shown.bg, "--f": shown.fg, "--a": shown.ac } as CSSProperties} />
        <b style={{ fontFamily: note ? undefined : shown.font }}>{pk.name}</b>
        <span>{pk.sub}</span>
      </div>
      <button
        type="button"
        className="sw-puck"
        aria-label={`Look: ${tint.name}. Open the look picker`}
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onFocus={() => { s.current.wantFocus = true; }}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") setOpen(true); }} // a tap opens; hover does it for a mouse
      />
    </div>
  );
}
