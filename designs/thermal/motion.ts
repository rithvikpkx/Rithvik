"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { STOPS, T_MAX, T_MIN, palIndex, sstep, type PalId } from "./heat";

const KEY = "rv7-thermal-pal";
const listeners = new Set<() => void>();

/** The stored palette (iron when unset or storage is unavailable). */
export function readPal(): PalId {
  if (typeof window === "undefined") return "iron"; // SSR: Node's own localStorage stub warns on access
  try { const v = localStorage.getItem(KEY); return v && v in STOPS ? (v as PalId) : "iron"; } catch { return "iron"; }
}
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The mockup's mount(), split by concern: the palette (store, `html[data-th-pal]`, the calibration sweep on the
 *  shader's `u_pv` uniform), the spot meter that follows a fine pointer across the hero, and the nav (smooth jumps,
 *  current section, solid bar once scrolled). Everything it adds is removed on unmount (design switch). */
export function useThermalMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  // server and first client render say iron (so markup hydrates); the stored choice follows
  const pal = useSyncExternalStore(subscribe, readPal, () => "iron" as PalId);
  const [nuc, setNuc] = useState(false);
  const sweepRaf = useRef(0);

  /** Sets the palette uniform: x = from, y = to, z = sweep progress (0 = at rest). False means no shader (CSS fallback). */
  const pv = useCallback((a: number, b: number, k: number) => {
    const ok = setUniform("u_pv", [a, b, k]), html = document.documentElement;
    if (ok) delete html.dataset.thGl; else html.dataset.thGl = "css";
    return ok;
  }, [setUniform]);

  /** Calibration sweep from one palette to another (instant in performance mode). */
  const sweep = useCallback((from: number, to: number, ms = 760) => {
    cancelAnimationFrame(sweepRaf.current);
    if (calm()) { pv(to, to, 0); return; }
    const t0 = performance.now();
    setNuc(true);
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      if (!pv(from, to, k < 1 ? k : 1)) { setNuc(false); return; }
      if (k < 1) sweepRaf.current = requestAnimationFrame(step);
      else setNuc(false);
    };
    sweepRaf.current = requestAnimationFrame(step);
  }, [pv]);

  /** Switches palette: persists it, re-maps the page and runs the sweep. */
  const choose = useCallback((next: PalId) => {
    const cur = readPal();
    if (next === cur) return;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice just won't persist */ }
    listeners.forEach((f) => f());
    sweep(palIndex(cur), palIndex(next));
  }, [sweep]);

  // palette → CSS (scale bar, hot accents, ramps all key off html[data-th-pal])
  useEffect(() => {
    document.documentElement.dataset.thPal = pal;
  }, [pal]);

  // the first load runs a calibration sweep too (the shader's initial u_pv is the stored palette at rest)
  useEffect(() => {
    let r = requestAnimationFrame(() => { r = requestAnimationFrame(() => { const i = palIndex(readPal()); sweep(i, i, 1100); }); });
    return () => { cancelAnimationFrame(r); cancelAnimationFrame(sweepRaf.current); const h = document.documentElement; delete h.dataset.thPal; delete h.dataset.thGl; };
  }, [sweep]);

  // spot meter + nav
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    const hero = $<HTMLElement>("#top"), meter = $<HTMLElement>("#th-meter"), mv = $<HTMLElement>("#th-mv"), mk = $<HTMLElement>("#th-mk"), bar = $<HTMLElement>(".th-scale-bar"), ptl = $<HTMLElement>(".th-pt-l");
    let mRaf = 0, heroIo: IntersectionObserver | undefined;
    if (hero && meter && mv && mk && bar) {
      let px = 0, py = 0, sx: number | null = null, sy = 0, lastTxt = 0, vis = false, heroOn = true;
      const readout = (now: number) => {
        const hh = hero.clientHeight || 1, d = Math.hypot(px - sx!, py - sy) / hh;
        // mirrors the shader: the hot core sits on the smoothed pointer, so moving fast reads cooler than resting
        const hand = Math.exp(-d * d * 60) * 0.5 + Math.exp(-d * d * 8) * 0.24;
        const coolX = innerWidth > hh * 1.15 ? 0.38 + 0.62 * sstep(0.36, 0.64, px / hero.clientWidth) : 1;
        const h = (0.24 + 0.05 * Math.sin(now / 1900)) * coolX + hand * (0.55 + 0.45 * coolX);
        return T_MIN + (T_MAX - T_MIN) * Math.min(1, h);
      };
      const tick = (now: number) => {
        mRaf = 0; if (sx === null) { sx = px; sy = py; }
        const k = calm() ? 1 : 0.06; // the core smooths u_mouse at 0.06 per frame; follow it so the reading trails the same way
        sx += (px - sx) * k; sy += (py - sy) * k;
        meter.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
        if (now - lastTxt > 110) { // sensor rate, not frame rate
          lastTxt = now;
          if (vis) mk.style.opacity = "0";
          else { const T = readout(now); mv.textContent = T.toFixed(1); mk.style.opacity = "1"; mk.style.transform = `translateY(${((1 - (T - T_MIN) / (T_MAX - T_MIN)) * bar.clientHeight).toFixed(1)}px)`; }
        }
        if (!calm() && heroOn && Math.hypot(px - sx, py - sy) > 0.6) mRaf = requestAnimationFrame(tick);
      };
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        on(hero, "pointermove", (e) => {
          const ev = e as PointerEvent;
          if (ev.pointerType === "touch") return;
          const r = hero.getBoundingClientRect(); px = ev.clientX - r.left; py = ev.clientY - r.top;
          vis = !!(ev.target as Element).closest?.(".pt-photo");
          hero.classList.add("is-metering"); meter.classList.toggle("is-vis", vis); ptl?.classList.toggle("on", vis);
          if (!mRaf) mRaf = requestAnimationFrame(tick);
        }, { passive: true });
        on(hero, "pointerleave", () => { hero.classList.remove("is-metering"); ptl?.classList.remove("on"); });
      }
      heroIo = new IntersectionObserver((en) => { heroOn = en[0].isIntersecting; });
      heroIo.observe(hero);
    }

    // the section you're reading
    const links = $$<HTMLAnchorElement>(".th-navl a");
    const secIo = new IntersectionObserver((en) => en.forEach((x) => {
      if (!x.isIntersecting) return;
      links.forEach((l) => (l.dataset.thGo === x.target.id ? l.setAttribute("aria-current", "true") : l.removeAttribute("aria-current")));
    }), { rootMargin: "-45% 0px -50% 0px" });
    $$(".th-sec, #top").forEach((s) => secIo.observe(s));
    const nav = $<HTMLElement>(".th-nav");
    on(window, "scroll", () => nav?.classList.toggle("is-past", scrollY > 40), { passive: true });

    return () => { offs.forEach((f) => f()); cancelAnimationFrame(mRaf); heroIo?.disconnect(); secIo.disconnect(); };
  }, [root]);

  return { pal, nuc, choose };
}
