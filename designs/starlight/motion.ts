"use client";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { kick } from "@/lib/shader/runtime";
import { useSite } from "@/components/site/SiteProvider";
import { hyOf, nearestQuad2, quadOf } from "./geo";

export type Flare = (x: number, y: number, k: number) => void;

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const two = (n: number) => String(n).padStart(2, "0");

/** The mockup's mount(): HUD readouts, auto-gain flare, scroll-driven waypoints and elevation, and the IR
 *  illuminator in the DOM (annotation + graph-edge reveals, beam ring). `flare` is handed back through
 *  `flareRef` so the phosphor switch can trigger it. Everything is undone on unmount (design switch). */
export function useStarlightMotion(root: RefObject<HTMLElement | null>, flareRef: MutableRefObject<Flare>) {
  const { overlay } = useSite();
  const bloomRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [], timers: ReturnType<typeof setTimeout>[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

    // HUD: local timestamp, battery, gain with automatic gain control (place clocks are React <Clock>s)
    const ts = $("[data-sl-ts]")!, gainEl = $("[data-sl-gain]")!, cells = $<HTMLElement>("[data-sl-cells]")!, batEl = $("[data-sl-bat]")!;
    const tick = () => { const d = new Date(); ts.textContent = `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };
    tick(); timers.push(setInterval(tick, 1000));
    type Battery = EventTarget & { level: number; charging: boolean };
    let battery: Battery | null = null;
    const batUp = () => { if (!battery) return; cells.dataset.lv = String(Math.max(1, Math.ceil(battery.level * 4))); batEl.textContent = battery.charging ? "EXT" : Math.round(battery.level * 100) + "%"; };
    const nav = navigator as Navigator & { getBattery?: () => Promise<Battery> };
    nav.getBattery?.().then((b) => { if (!el.isConnected) return; battery = b; batUp(); b.addEventListener("levelchange", batUp); b.addEventListener("chargingchange", batUp); }).catch(() => {});
    let dip = 0;
    const base = 0.82;
    const gainTick = () => { if (calm()) { gainEl.textContent = base.toFixed(2); return; } dip *= 0.82; gainEl.textContent = Math.max(0.2, base - dip * 0.6 + (Math.random() - 0.5) * 0.012).toFixed(2); };
    timers.push(setInterval(gainTick, 180));

    // auto-gain flare: the scene behind the content blooms, then the tube pulls the gain back down
    const flareEl = $<HTMLElement>(".sl-flare")!; let lastFlare = 0;
    const flare: Flare = (x, y, k) => {
      if (calm()) return;
      const now = performance.now(); if (k < 0.5 && now - lastFlare < 1400) return; lastFlare = now;
      flareEl.style.setProperty("--fx", Math.round(x) + "px"); flareEl.style.setProperty("--fy", Math.round(y) + "px");
      flareEl.getAnimations().forEach((a) => a.cancel());
      flareEl.animate([{ opacity: 0 }, { opacity: k, offset: 0.14 }, { opacity: k * 0.25, offset: 0.45 }, { opacity: 0 }], { duration: 1300, easing: "cubic-bezier(.2,.7,.25,1)" });
      dip = Math.max(dip, k);
    };
    flareRef.current = flare;
    $$(".sl-cta").forEach((b) => on(b, "pointerenter", (e) => { if ((e as PointerEvent).pointerType !== "mouse") return; const r = b.getBoundingClientRect(); flare(r.left + r.width / 2, r.top + r.height / 2, 0.28); }));
    // something bright appears (case sheet, window): its own surface blooms too. Overlays are lazy chunks,
    // so the surface is looked up for a moment after it opens.
    bloomRef.current = () => {
      let tries = 0;
      const find = () => {
        const surf = document.querySelector<HTMLElement>(".sheet-body, .win.front");
        if (surf) {
          if (calm()) return;
          surf.classList.remove("sl-bloom"); void surf.offsetWidth; surf.classList.add("sl-bloom");
          timers.push(setTimeout(() => surf.classList.remove("sl-bloom"), 1100));
          flare(innerWidth / 2, innerHeight / 2, 0.55);
        } else if (++tries < 20) timers.push(setTimeout(find, 50));
      };
      find();
    };
    // the tube powers on
    timers.push(setTimeout(() => flare(innerWidth * 0.3, innerHeight * 0.45, 0.42), 220));

    // scroll: elevation ruler and the waypoints riding the horizon (same formula as the shader)
    const elM = $<HTMLElement>("[data-sl-el]")!, wps = $<HTMLElement>(".sl-wps")!, ruler = $<HTMLElement>(".sl-ruler")!;
    let sraf = 0, elev = 9;
    const scrollStep = () => {
      sraf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), s = Math.min(1, scrollY / max), hy = hyOf(s);
      elev = Math.max(-40, (0.5 - Math.min(hy, 1.8)) * 30);
      elM.textContent = `EL ${elev >= 0 ? "+" : "-"}${two(Math.round(Math.abs(elev)))}°`;
      elM.style.transform = `translateY(${((20 - elev) / 60) * (ruler.clientHeight - 18)}px)`;
      const y = (1 - (hy + 0.022)) * innerHeight;
      wps.style.transform = `translate3d(0, ${Math.round(y)}px, 0)`;
      wps.classList.toggle("is-off", y < -40 || y > innerHeight);
    };
    // in performance mode the runtime paints one still frame; repaint a single new still once scrolling settles,
    // so reading text still sits over the dark field rather than the first screen's sky
    let kt: ReturnType<typeof setTimeout> | undefined;
    on(window, "scroll", () => { if (!sraf) sraf = requestAnimationFrame(scrollStep); if (calm()) { clearTimeout(kt); kt = setTimeout(kick, 140); } }, { passive: true });
    on(window, "resize", () => { if (!sraf) sraf = requestAnimationFrame(scrollStep); });
    scrollStep();

    // IR illuminator in the DOM: reveal annotations and graph edges near the pointer; the ring tracks the cone
    const hero = $<HTMLElement>(".ly-hero")!, ring = $<HTMLElement>(".sl-ring")!, ringL = $("[data-sl-ring]")!;
    const ptr = { x: innerWidth / 2, y: innerHeight / 2, in: false, ui: false }, fast = { x: ptr.x, y: ptr.y }, cone = { x: ptr.x, y: ptr.y };
    let iraf = 0, edges: SVGPathElement[] = [];
    const ePrev = new WeakMap<Element, number>(), geo = new WeakMap<Element, { d: string; q: number[] }>();
    // edge geometry is cached per path but keyed on `d`, since React rewrites it when the graph resizes
    const quad = (p: SVGPathElement) => { const d = p.getAttribute("d") ?? "", g = geo.get(p); if (g && g.d === d) return g.q; const q = quadOf(d); geo.set(p, { d, q }); return q; };
    const near = (r: DOMRect, x: number, y: number) => { const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom); return dx * dx + dy * dy; };
    let heroOn = true, graphOn = false;
    let graph: Element | null = null;
    const vis = new IntersectionObserver((en) => en.forEach((e) => { if (e.target === hero) { heroOn = e.isIntersecting; hero.classList.toggle("sl-live", heroOn); } else graphOn = e.isIntersecting; }));
    vis.observe(hero);
    // the graph measures itself before drawing, so look for it lazily
    const watchGraph = () => { if (graph?.isConnected) return; graph = $(".kg"); if (graph) vis.observe(graph); };
    watchGraph();
    function irStep() {
      iraf = 0; if (calm()) return;
      watchGraph();
      fast.x += (ptr.x - fast.x) * 0.2; fast.y += (ptr.y - fast.y) * 0.2;
      cone.x += (ptr.x - cone.x) * 0.06; cone.y += (ptr.y - cone.y) * 0.06; // the runtime smooths u_mouse at the same rate
      const R2 = 150 * 150;
      $$<HTMLElement>("[data-ir]").forEach((e) => {
        const r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
        e.style.setProperty("--ir", Math.exp(-near(r, fast.x, fast.y) / R2).toFixed(3));
      });
      const svg = graph && graphOn ? graph.querySelector<SVGSVGElement>(".kg-svg") : null;
      if (svg) {
        if (!edges.length || !edges[0].isConnected) edges = Array.from(svg.querySelectorAll<SVGPathElement>(".kg-edge"));
        const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, k = vb && vb.width ? r.width / vb.width : 1;
        const lx = (fast.x - r.left) / k, ly = (fast.y - r.top) / k, ER = (130 / k) ** 2;
        edges.forEach((p) => {
          const v = Math.exp(-nearestQuad2(quad(p), lx, ly) / ER), pv = ePrev.get(p) ?? 0;
          if (Math.abs(v - pv) > 0.02 || (v < 0.02 && pv > 0)) { const q = v < 0.02 ? 0 : v; ePrev.set(p, q); p.style.setProperty("--ir", q.toFixed(2)); }
        });
      }
      const show = heroOn && ptr.in && !ptr.ui && ptr.y < hero.getBoundingClientRect().bottom;
      ring.classList.toggle("is-on", show);
      ring.style.transform = `translate3d(${cone.x.toFixed(1)}px, ${cone.y.toFixed(1)}px, 0)`;
      const az = 270 + (cone.x / innerWidth - 0.5) * 60, e2 = elev + (0.5 - cone.y / innerHeight) * 24;
      ringL.textContent = `IR · AZ ${Math.round(az)}° · EL ${e2 >= 0 ? "+" : "-"}${two(Math.round(Math.abs(e2)))}°`;
      if (Math.abs(ptr.x - cone.x) + Math.abs(ptr.y - cone.y) > 0.6) iraf = requestAnimationFrame(irStep);
    }
    if (fine) {
      on(window, "pointermove", (ev) => {
        const e = ev as PointerEvent; if (e.pointerType !== "mouse") return;
        ptr.x = e.clientX; ptr.y = e.clientY; ptr.in = true;
        ptr.ui = !!(e.target as Element).closest?.(".ly-head, .pt, .agent, .win, .sheet-body");
        if (!iraf && !calm()) iraf = requestAnimationFrame(irStep);
      }, { passive: true });
      on(document, "pointerleave", () => { ptr.in = false; ring.classList.remove("is-on"); });
      on(window, "scroll", () => { if (ptr.in && !iraf && !calm()) iraf = requestAnimationFrame(irStep); }, { passive: true });
    } else el.classList.add("sl-touch");

    return () => {
      offs.forEach((f) => f()); timers.forEach((t) => { clearInterval(t); clearTimeout(t); });
      vis.disconnect(); clearTimeout(kt); cancelAnimationFrame(sraf); cancelAnimationFrame(iraf);
      flareEl.getAnimations().forEach((a) => a.cancel());
      if (battery) { battery.removeEventListener("levelchange", batUp); battery.removeEventListener("chargingchange", batUp); }
      document.querySelectorAll(".sl-bloom").forEach((e) => e.classList.remove("sl-bloom"));
      bloomRef.current = () => {}; flareRef.current = () => {};
    };
  }, [root, flareRef]);

  // a window or the case sheet opening is the "something bright appears" moment (the agent dock is not)
  useEffect(() => { if (overlay && overlay.kind !== "agent") bloomRef.current(); }, [overlay]);
}
