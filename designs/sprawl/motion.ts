"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { SLOTS, decay, pushPoint, type Pt } from "./trail";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const GLITCH_MS = 380;

/** The look's one effect: the pointer wipes the fogged window (a decaying trail fed to the shader), a click on the
 *  hero tears the glass with a short holo glitch, and neon tubes (section ornaments, the contact sign) ignite once
 *  as they scroll in. Everything it adds is removed on unmount (design switch). */
export function useSprawlMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const hero = el.querySelector<HTMLElement>("#top");
    let trail: Pt[] = [], raf = 0, last = 0, g0 = 0, gl = true;

    /** Pushes the trail and glitch to the shader; false when there is no shader (stop trying). */
    const send = (g: number) => {
      for (let i = 0; i < SLOTS; i++) if (!setUniform(`u_t${i}`, trail[i] ?? [0, 0, 0])) return (gl = false);
      return setUniform("u_glitch", g);
    };
    const tick = (now: number) => {
      raf = 0;
      trail = decay(trail, last ? Math.min(64, now - last) : 16);
      last = now;
      const g = g0 ? Math.max(0, 1 - (now - g0) / GLITCH_MS) : 0;
      if (!g) { g0 = 0; hero?.classList.remove("sp-tear"); }
      if (!send(g)) return;
      if (trail.length || g) raf = requestAnimationFrame(tick);
      else last = 0;
    };
    const wake = () => { if (!raf && gl) raf = requestAnimationFrame(tick); };

    if (hero) {
      on(hero, "pointermove", (e) => {
        if (calm()) return;
        const ev = e as PointerEvent, r = hero.getBoundingClientRect();
        trail = pushPoint(trail, (ev.clientX - r.left) / r.width, 1 - (ev.clientY - r.top) / r.height);
        wake();
      }, { passive: true });
      on(hero, "click", (e) => {
        // only the glass tears: links, buttons, the portrait and editable copy keep their own clicks
        if (calm() || (e.target as Element).closest?.("a, button, input, textarea, .pt, [data-edit]")) return;
        g0 = performance.now(); hero.classList.add("sp-tear"); wake();
      });
    }

    // neon ignition: each tube flickers on once when it first comes into view (lit at once when calm)
    const tubes = Array.from(el.querySelectorAll<HTMLElement>(".sp-tube, .sp-sign"));
    const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { (x.target as HTMLElement).dataset.on = ""; io.unobserve(x.target); } }), { threshold: 0.35 });
    tubes.forEach((t) => (calm() ? (t.dataset.on = "") : io.observe(t)));

    return () => { offs.forEach((f) => f()); cancelAnimationFrame(raf); io.disconnect(); hero?.classList.remove("sp-tear"); };
  }, [root, setUniform]);
}
