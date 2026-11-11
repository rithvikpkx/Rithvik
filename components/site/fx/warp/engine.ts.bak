/* The warp runtime: ONE pointer listener and ONE rAF loop shared by every registered card. Only cards near the pointer
   (or still settling) are touched; each gets a spring-driven `clip-path: path()` plus an SVG stroke that redraws its border
   along the same path. The loop stops when everything has settled, and is a no-op in performance mode / reduced motion. */
import { buildCtrl, dentTargets, stepSprings, warpPath, type Ctrl, type Radii } from "./geometry.ts";

interface Item {
  el: HTMLElement; svg: SVGSVGElement | null; path: SVGPathElement | null;
  w: number; h: number; radii: Radii; ctrl: Ctrl[]; x: Float32Array; v: Float32Array; tgt: Float32Array;
  depth: number; sigma: number; strength: number; dirty: boolean; visible: boolean; on: boolean; hold: number;
}
interface Pointer { x: number; y: number; touch: boolean }

const items = new Map<HTMLElement, Item>();
let pointer: Pointer | null = null, raf = 0, last = 0, bound = false, io: IntersectionObserver | null = null, ro: ResizeObserver | null = null;
const NS = "http://www.w3.org/2000/svg";
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const calm = () => document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Measures the card (size, its own corner radii) and rebuilds its control points; the corner radii come from CSS so a skin can reshape the card. */
function layout(it: Item) {
  const el = it.el, cs = getComputedStyle(el);
  it.w = el.offsetWidth; it.h = el.offsetHeight;
  it.radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((r) => parseFloat(r) || 0) as Radii;
  it.ctrl = buildCtrl(it.w, it.h, it.radii);
  it.x = new Float32Array(it.ctrl.length); it.v = new Float32Array(it.ctrl.length); it.tgt = new Float32Array(it.ctrl.length);
  const m = Math.min(it.w, it.h);
  it.depth = clamp(m * 0.055, 8, 20); it.sigma = clamp(m * 0.32, 50, 120);
  it.dirty = false;
}

/** Puts a card back to its plain rectangle (no clip, no outline). */
function release(it: Item) {
  it.x.fill(0); it.v.fill(0); it.on = false;
  it.el.style.clipPath = ""; it.el.removeAttribute("data-warp");
}

/** Switches a card on: reads its strength token and adds the outline overlay once. */
function engage(it: Item): boolean {
  it.strength = parseFloat(getComputedStyle(it.el).getPropertyValue("--warp"));
  if (!(it.strength > 0) || it.w < 40 || it.h < 40) return false;
  if (it.el.querySelector(":focus-visible")) return false; // never clip a keyboard focus ring
  if (!it.svg) {
    it.svg = document.createElementNS(NS, "svg"); it.path = document.createElementNS(NS, "path");
    it.svg.setAttribute("class", "warp-edge"); it.svg.setAttribute("aria-hidden", "true");
    it.svg.append(it.path); it.el.append(it.svg);
  }
  it.on = true; it.el.setAttribute("data-warp", "");
  return true;
}

/** One frame: read every rect first, then step the springs and write the clip paths. */
function tick(now: number) {
  raf = 0;
  const dt = clamp((now - last) / 1000, 1 / 240, 0.05); last = now;
  if (calm()) { items.forEach((it) => it.on && release(it)); return; }
  const rects = new Map<Item, DOMRect>();
  items.forEach((it) => { if (it.visible && (pointer || it.on)) rects.set(it, it.el.getBoundingClientRect()); });
  let busy = false;
  items.forEach((it) => {
    const r = rects.get(it);
    if (!r) { if (it.on) release(it); return; }
    if (it.hold > now) { if (it.on) release(it); return; }
    if (it.dirty) layout(it);
    let near = false, scale = 1;
    if (pointer) {
      // the pointer in the card's own box (offsetWidth, so a resting tilt does not matter), and its distance outside it
      const lx = pointer.x - (r.left + r.width / 2) + it.w / 2, ly = pointer.y - (r.top + r.height / 2) + it.h / 2;
      const dx = Math.max(-lx, 0, lx - it.w), dy = Math.max(-ly, 0, ly - it.h);
      near = Math.hypot(dx, dy) < it.sigma * 1.8;
      scale = dx === 0 && dy === 0 ? (pointer.touch ? 0.7 : 0.4) : 1; // over the card itself: a gentler push
      if (near && !it.on && !engage(it)) near = false;
      if (near) dentTargets(it.ctrl, lx, ly, it.depth * it.strength, it.sigma, scale, it.tgt);
    }
    if (!it.on) return;
    if (!near) it.tgt.fill(0);
    const rest = stepSprings(it.x, it.v, it.tgt, dt);
    if (!near && rest < 0.05) { release(it); return; }
    const d = warpPath(it.w, it.h, it.radii, it.ctrl, it.x);
    it.el.style.clipPath = `path('${d}')`; it.path?.setAttribute("d", d);
    if (rest > 0.05 || !near) busy = true; // a held dent at rest needs no frames until the pointer moves again
  });
  if (busy) raf = requestAnimationFrame(tick);
}

/** Starts the loop if it is not running. */
function wake() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }

const onMove = (e: PointerEvent) => { if (e.pointerType === "touch") return; pointer = { x: e.clientX, y: e.clientY, touch: false }; wake(); };
const onDown = (e: PointerEvent) => { if (e.pointerType === "touch") { pointer = { x: e.clientX, y: e.clientY, touch: true }; wake(); } };
const onUp = (e: PointerEvent) => { if (e.pointerType === "touch") { pointer = null; wake(); } };
const onLeave = () => { pointer = null; wake(); };
const onScroll = () => { if (pointer) wake(); };

/** Adds the shared listeners once the first card registers. */
function bind() {
  bound = true;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });
  window.addEventListener("pointerup", onUp, { passive: true });
  window.addEventListener("pointercancel", onUp, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("blur", onLeave);
  document.documentElement.addEventListener("pointerleave", onLeave);
  io = new IntersectionObserver((es) => es.forEach((e) => { const it = items.get(e.target as HTMLElement); if (it) it.visible = e.isIntersecting; }), { rootMargin: "200px" });
  ro = new ResizeObserver((es) => es.forEach((e) => { const it = items.get(e.target as HTMLElement); if (it) it.dirty = true; }));
}

/** Removes them when the last card goes. */
function unbind() {
  bound = false; cancelAnimationFrame(raf); raf = 0; pointer = null;
  window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerdown", onDown);
  window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onUp);
  window.removeEventListener("scroll", onScroll); window.removeEventListener("blur", onLeave);
  document.documentElement.removeEventListener("pointerleave", onLeave);
  io?.disconnect(); ro?.disconnect(); io = ro = null;
}

/** Makes `el` a warping card; returns the cleanup. A click (a flip, a press) drops the warp for 700ms so a 3D flip is never clipped. */
export function registerWarp(el: HTMLElement): () => void {
  const it: Item = { el, svg: null, path: null, w: 0, h: 0, radii: [0, 0, 0, 0], ctrl: [], x: new Float32Array(0), v: new Float32Array(0), tgt: new Float32Array(0),
    depth: 12, sigma: 80, strength: 1, dirty: true, visible: true, on: false, hold: 0 };
  const click = () => { it.hold = performance.now() + 700; if (it.on) release(it); wake(); };
  el.addEventListener("click", click, true);
  items.set(el, it);
  if (!bound) bind();
  io?.observe(el); ro?.observe(el);
  return () => {
    el.removeEventListener("click", click, true);
    if (it.on) release(it);
    it.svg?.remove();
    io?.unobserve(el); ro?.unobserve(el);
    items.delete(el);
    if (!items.size) unbind();
  };
}
