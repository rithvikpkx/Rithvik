"use client";
import { useEffect, type RefObject } from "react";
import { kick, setUniform } from "@/lib/shader/runtime";
import { PHOTO, VIEW } from "@/components/site/tether/sim";

/** The photo fills this share of the prism's incircle, leaving an even rim of glass all round. */
const FILL = 0.85;

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The mockup's mount(): the lit hero switches the shader canvas on, headings split with scroll speed, the Play
 *  heading's anaglyph plates follow the pointer. Undone on unmount. */
export function usePrismMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    // the canvas only renders while the lit hero is on screen: off-screen it is display:none,
    // which stops the runtime's loop; in performance mode each entry repaints the one still frame
    const gl = $<HTMLElement>("#pr-gl"), lit = new Set<Element>();
    let kr = 0;
    const litIO = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? lit.add(e.target) : lit.delete(e.target)));
      gl?.classList.toggle("is-off", lit.size === 0);
      if (lit.size) { cancelAnimationFrame(kr); kr = requestAnimationFrame(kick); }
    });
    $$(".ly-hero").forEach((s) => litIO.observe(s));

    // the prism is drawn around the hero portrait: its centroid (the incircle's centre) sits on the photo's centre and
    // its size follows the photo, so it fits at any viewport and keeps pace with the page as the hero scrolls away
    const fig = $<HTMLElement>(".ly-hero .pt");
    let par = 0, tries = 0;
    const place = () => {
      par = 0;
      if (!fig) return;
      const r = fig.getBoundingClientRect(), vh = innerHeight;
      if (!r.width || r.bottom < -200 || r.top > vh + 200) return;
      const photoR = (r.width * PHOTO.r) / VIEW.w;
      const cx = r.left + (r.width * PHOTO.cx) / VIEW.w, cy = r.top + (r.height * PHOTO.cy) / VIEW.h;
      const ok = setUniform("u_pc", [cx / innerWidth, 1 - cy / vh]) && setUniform("u_pr", photoR / (FILL / Math.sqrt(3)) / vh);
      if (!ok && tries++ < 60) par = requestAnimationFrame(place); // the canvas mounts a beat after this effect
    };
    const queue = () => { if (!par) par = requestAnimationFrame(place); };
    on(window, "scroll", queue, { passive: true });
    on(window, "resize", queue);
    const figRO = fig ? new ResizeObserver(queue) : null;
    if (fig) figRO?.observe(fig);
    queue();

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

    return () => { offs.forEach((f) => f()); litIO.disconnect(); hIO.disconnect(); cancelAnimationFrame(craf); cancelAnimationFrame(araf); cancelAnimationFrame(kr); cancelAnimationFrame(par); figRO?.disconnect(); };
  }, [root]);
}
