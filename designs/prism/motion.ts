"use client";
import { useEffect, type RefObject } from "react";
import { kick } from "@/lib/shader/runtime";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The mockup's mount(): lit sections switch the shader canvas on, the nav gets its rule, headings split
 *  with scroll speed, the Play heading's anaglyph plates follow the pointer. Undone on unmount. */
export function usePrismMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    // the canvas only renders while a lit section (hero, Map) is on screen: off-screen it is display:none,
    // which stops the runtime's loop; in performance mode each entry repaints the one still frame
    const gl = $<HTMLElement>("#pr-gl"), lit = new Set<Element>();
    let kr = 0;
    const litIO = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? lit.add(e.target) : lit.delete(e.target)));
      gl?.classList.toggle("is-off", lit.size === 0);
      if (lit.size) { cancelAnimationFrame(kr); kr = requestAnimationFrame(kick); }
    });
    $$(".pr-lit").forEach((s) => litIO.observe(s));

    // nav: transparent over the light, a white rule once the page moves
    const nav = $<HTMLElement>("#pr-nav");
    const navState = () => nav?.classList.toggle("is-scrolled", scrollY > 12);
    navState();

    // chromatic aberration along the scroll: visible headings split vertically with scroll speed, then settle
    const heads = new Set<HTMLElement>();
    const clear = (h: HTMLElement) => { h.style.removeProperty("--cay"); h.style.removeProperty("--cao"); };
    const hIO = new IntersectionObserver((en) => en.forEach((e) => {
      const h = e.target as HTMLElement;
      if (e.isIntersecting) heads.add(h); else { heads.delete(h); clear(h); }
    }));
    $$<HTMLElement>(".pr-h2 .pr-ca").forEach((h) => hIO.observe(h));
    let lastY = scrollY, lastT = performance.now(), vel = 0, craf = 0;
    const caStep = () => {
      craf = 0;
      vel *= 0.86;
      const off = Math.max(-9, Math.min(9, vel * 5));
      const op = Math.min(1, Math.abs(off) / 3);
      heads.forEach((h) => { h.style.setProperty("--cay", off.toFixed(2) + "px"); h.style.setProperty("--cao", op.toFixed(3)); });
      if (Math.abs(off) > 0.05) craf = requestAnimationFrame(caStep);
      else heads.forEach(clear);
    };
    on(window, "scroll", () => {
      navState();
      const now = performance.now(), dt = Math.max(8, now - lastT), dy = scrollY - lastY;
      lastY = scrollY; lastT = now;
      if (calm()) return;
      // px per ms, smoothed; the split follows the direction of travel
      vel = vel * 0.6 + (dy / dt) * 0.4;
      if (!craf) craf = requestAnimationFrame(caStep);
    }, { passive: true });

    // anaglyph depth: the red and cyan plates part with the pointer, like leaning toward a 3D print
    const ana = $<HTMLElement>(".pr-ana"), play = $<HTMLElement>("#play");
    let araf = 0, ap = [0.5, 0.5];
    const anaStep = () => { araf = 0; ana?.style.setProperty("--ax", ((ap[0] - 0.5) * 18).toFixed(2) + "px"); ana?.style.setProperty("--ay", ((ap[1] - 0.5) * 6).toFixed(2) + "px"); };
    if (matchMedia("(hover: hover) and (pointer: fine)").matches && ana && play) {
      on(play, "pointermove", (e) => { if (calm()) return; const r = play.getBoundingClientRect(), p = e as PointerEvent; ap = [(p.clientX - r.left) / r.width, (p.clientY - r.top) / r.height]; if (!araf) araf = requestAnimationFrame(anaStep); }, { passive: true });
      on(play, "pointerleave", () => { ap = [0.5, 0.5]; if (!araf) araf = requestAnimationFrame(anaStep); });
    }

    return () => { offs.forEach((f) => f()); litIO.disconnect(); hIO.disconnect(); cancelAnimationFrame(craf); cancelAnimationFrame(araf); cancelAnimationFrame(kr); };
  }, [root]);
}
