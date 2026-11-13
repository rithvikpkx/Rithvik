"use client";
import { useEffect, type RefObject } from "react";

/** The mockup's mount(): the square lens on the hero name and dispatch plates (fine pointers), and
 *  section liveness for ambient loops. Everything added is removed on unmount (design switch). */
export function useStippleMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    // crisp duplicate plate revealed through a clip-path window that follows the pointer
    if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
      el.querySelectorAll<HTMLElement>("[data-lens]").forEach((lens) => {
        const xy = lens.querySelector<HTMLElement>(".st-lens-xy");
        let raf = 0, x = 0, y = 0;
        const paint = () => { raf = 0; lens.style.setProperty("--lx", x + "px"); lens.style.setProperty("--ly", y + "px"); if (xy) xy.textContent = `x ${String(Math.round(x)).padStart(3, "0")} · y ${String(Math.round(y)).padStart(3, "0")}`; };
        const host = lens.closest(".st-dsp") ?? lens;
        on(host, "pointermove", (e) => {
          if (document.documentElement.classList.contains("lite")) return;
          const r = lens.getBoundingClientRect(), p = e as PointerEvent; x = p.clientX - r.left; y = p.clientY - r.top;
          lens.classList.add("st-on"); if (!raf) raf = requestAnimationFrame(paint);
        }, { passive: true });
        on(host, "pointerleave", () => { lens.classList.remove("st-on"); cancelAnimationFrame(raf); raf = 0; });
        offs.push(() => cancelAnimationFrame(raf));
      });
    }

    // ambient loops (lens drift, seal rotation, status pulse) only run while their section is on screen
    const io = new IntersectionObserver((en) => en.forEach((e) => e.target.classList.toggle("st-live", e.isIntersecting)), { rootMargin: "80px" });
    el.querySelectorAll(".ly-hero, .st-seal-sec").forEach((s) => io.observe(s));

    return () => { offs.forEach((f) => f()); io.disconnect(); };
  }, [root]);
}
