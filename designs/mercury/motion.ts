"use client";
import { useEffect, type RefObject } from "react";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The meniscus "ring once" keyframes (transform only). */
const RING: Keyframe[] = [
  { transform: "translateX(0) scaleY(0)" }, { transform: "translateX(-14px) scaleY(1)", offset: 0.1 },
  { transform: "translateX(10px) scaleY(-.62)", offset: 0.3 }, { transform: "translateX(-6px) scaleY(.36)", offset: 0.5 },
  { transform: "translateX(3px) scaleY(-.18)", offset: 0.7 }, { transform: "translateX(0) scaleY(.06)", offset: 0.86 }, { transform: "translateX(0) scaleY(0)" },
];

/** The mockup's mount(): the shader host shows only while hero or contact is on screen (the runtime
 *  pauses when it is hidden), meniscus dividers ring on entry/hover, and the Play ribbon drifts with scroll.
 *  Everything it adds is removed on unmount (design switch). */
export function useMercuryMotion(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const host = $<HTMLElement>("#mc-gl"), nav = $<HTMLElement>(".mc-nav"), contact = $<HTMLElement>(".mc-contact");

    const seen = new Set<string>();
    const gio = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      if (host) host.style.display = seen.size ? "" : "none";
      nav?.classList.toggle("mc-solidnav", !seen.has("top"));
      contact?.classList.toggle("mc-live", seen.has("contact"));
    }, { threshold: 0 });
    $$("#top, #contact").forEach((s) => gio.observe(s));

    const ring = (svg: Element) => {
      const w = svg.querySelector<SVGPathElement>(".mc-wave");
      if (!w || calm() || w.dataset.on) return;
      w.dataset.on = "1";
      const a = w.animate(RING, { duration: 2000, easing: "cubic-bezier(.37,0,.63,1)" });
      a.onfinish = a.oncancel = () => { delete w.dataset.on; };
    };
    const dio = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) ring(e.target); }), { rootMargin: "0px 0px -18% 0px" });
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    $$(".mc-div svg").forEach((s) => { dio.observe(s); if (fine) on(s.parentNode, "pointerenter", () => ring(s)); });

    const play = $<HTMLElement>(".mc-play"), rib = $<HTMLElement>(".mc-ribbon img");
    let pin = false, sraf = 0;
    const pio = new IntersectionObserver((en) => { pin = en[0].isIntersecting; }, { rootMargin: "80px" });
    if (play) pio.observe(play);
    const drift = () => {
      sraf = 0; if (!rib || !play) return;
      const r = play.getBoundingClientRect(), k = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      rib.style.transform = `translate3d(${(k * -5).toFixed(2)}%, 0, 0)`;
    };
    on(window, "scroll", () => { if (pin && !calm() && !sraf) sraf = requestAnimationFrame(drift); }, { passive: true });

    return () => {
      offs.forEach((f) => f()); gio.disconnect(); dio.disconnect(); pio.disconnect(); cancelAnimationFrame(sraf);
      if (host) host.style.display = "";
      $$<SVGPathElement>(".mc-wave").forEach((w) => w.getAnimations().forEach((a) => a.cancel()));
    };
  }, [root]);
}
