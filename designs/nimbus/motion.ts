"use client";
import { useEffect, type RefObject } from "react";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The mockup's mount(): section liveness, pointer-shy band clouds. Everything it adds is
 *  removed on unmount (design switch). */
export function useNimbusMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

    // ambient loops (band clouds, card drift) only run while their section is on screen
    const io = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle("nb-live", e.isIntersecting)), { rootMargin: "60px" });
    $$(".nb-band").forEach((s) => io.observe(s));

    // the band's clouds drift away from the pointer and spring back (snapped to 4px so they stay pixel art)
    const band = $<HTMLElement>(".nb-band"), bcs = $$<HTMLElement>(".nb-bc-in"), st = bcs.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
    let braf = 0, bp: [number, number] | null = null;
    const bstep = () => {
      braf = 0; let moving = false;
      bcs.forEach((c, i) => {
        const s = st[i]; s.tx = 0; s.ty = 0;
        if (bp) {
          const r = c.getBoundingClientRect(), dx = r.left + r.width / 2 - bp[0], dy = r.top + r.height / 2 - bp[1], d = Math.hypot(dx, dy) || 1, R = 220;
          if (d < R) { const k = (1 - d / R) ** 2 * 90; s.tx = (dx / d) * k; s.ty = (dy / d) * k * 0.6; }
        }
        s.x += (s.tx - s.x) * 0.12; s.y += (s.ty - s.y) * 0.12;
        if (Math.abs(s.tx - s.x) > 0.3 || Math.abs(s.ty - s.y) > 0.3) moving = true;
        c.style.transform = `translate3d(${Math.round(s.x / 4) * 4}px, ${Math.round(s.y / 4) * 4}px, 0)`;
      });
      if (moving || bp) braf = requestAnimationFrame(bstep);
    };
    if (fine && band) {
      on(band, "pointermove", (e) => { if (calm()) return; const p = e as PointerEvent; bp = [p.clientX, p.clientY]; if (!braf) braf = requestAnimationFrame(bstep); }, { passive: true });
      on(band, "pointerleave", () => { bp = null; if (!braf) braf = requestAnimationFrame(bstep); });
    }

    return () => { offs.forEach((f) => f()); io.disconnect(); cancelAnimationFrame(braf); };
  }, [root]);
}
