"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { coord, dims, mm } from "./drafting";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** What the draftsman's cursor measures: the page's real objects, not every span. */
const MEASURE = ".ly-btn, .ly-iam, .ly-nav a, .ly-title, .pt-photo, .pt-node, .cl-node, .wk-item, .wk-disc, .ly-st-body, .ly-edu-obj, .ab-tile, .ab-chip, .qz-tile, .pf-wrap";
/** Floating chrome the cursor stays out of. */
const CHROME = ".agent, .win, .sheet, .toast, .theme-dial-aside, .lite-toggle";

/** Blueprint's mount(): the sheet scrolls with the page (`u_sy`), lines plot themselves as they enter the view
 *  (`.bp-draw` gets `data-drawn`; nothing is hidden unless motion is allowed), the hero's dimension and leader track
 *  the real name and photo, the Work disc carries its live diameter, and a fine pointer gets the draftsman's cursor
 *  (rulers, a coordinate readout, and a measured box on whatever it rests over). Everything is undone on unmount. */
export function useBlueprintMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    // pen plotter: armed only when motion is allowed, so calm visitors get a fully drawn sheet
    if (!calm()) el.setAttribute("data-bp-armed", "");
    const plot = new IntersectionObserver((en) => en.forEach((e) => {
      if (e.isIntersecting) { (e.target as HTMLElement).dataset.drawn = ""; plot.unobserve(e.target); }
    }), { threshold: 0, rootMargin: "0px 0px -12% 0px" }); // plot once a sheet edge is a little way up the screen
    el.querySelectorAll(".stage > section:not(#top) .bp-draw").forEach((d) => plot.observe(d));
    // the hero is on screen at load, so its marks plot at once (an element hidden by its own clip never "intersects")
    let hRaf = requestAnimationFrame(() => { hRaf = requestAnimationFrame(() => el.querySelectorAll<HTMLElement>(".bp-hero .bp-draw").forEach((d) => { d.dataset.drawn = ""; })); });

    // the paper travels with the drawing; stop asking if the shader is missing (no WebGL)
    let gl = true, sRaf = 0;
    const sheet = () => { sRaf = 0; if (gl) gl = setUniform("u_sy", scrollY / Math.max(1, innerHeight)); };
    sheet();
    on(window, "scroll", () => { if (!sRaf) sRaf = requestAnimationFrame(sheet); }, { passive: true });

    // live dimensions on the real objects: the name's width, the photo's leader, the disc's diameter
    const hero = $<HTMLElement>("#top"), dimEl = $<HTMLElement>(".bp-dim-name"), dimTxt = $<HTMLElement>(".bp-dim-name .bp-dim-v"), lead = $<HTMLElement>(".bp-lead");
    const measure = () => {
      if (!hero) return;
      const h = hero.getBoundingClientRect();
      const cells = Array.from(hero.querySelectorAll<HTMLElement>(".ly-name .kn-l"));
      const boxes = (cells.length ? cells : Array.from(hero.querySelectorAll<HTMLElement>(".ly-name > *"))).map((c) => c.getBoundingClientRect());
      if (dimEl && dimTxt && boxes.length) {
        const l = Math.min(...boxes.map((b) => b.left)), r = Math.max(...boxes.map((b) => b.right)), t = Math.min(...boxes.map((b) => b.top));
        dimEl.style.setProperty("--l", `${(l - h.left).toFixed(1)}px`);
        dimEl.style.setProperty("--t", `${(t - h.top).toFixed(1)}px`);
        dimEl.style.setProperty("--w", `${(r - l).toFixed(1)}px`);
        dimTxt.textContent = mm(r - l);
      }
      const photo = hero.querySelector<HTMLElement>(".pt-photo");
      if (lead && photo) {
        const p = photo.getBoundingClientRect();
        lead.style.setProperty("--x", `${(p.left - h.left - 3).toFixed(1)}px`); // the arrow lands on the photo's left edge
        lead.style.setProperty("--y", `${(p.top - h.top + p.height * 0.22).toFixed(1)}px`);
      }
      el.querySelectorAll<HTMLElement>(".wk-disc").forEach((d) => { d.dataset.dia = mm(d.getBoundingClientRect().width); });
    };
    measure();
    const ro = new ResizeObserver(measure);
    [hero, $(".ly-name"), $(".wk-disc")].forEach((n) => n && ro.observe(n));
    document.fonts?.ready.then(measure);
    // the portrait drops in on a spring; take its resting place once it has landed
    const late = setTimeout(measure, 1200);

    // the draftsman's cursor
    const cur = $<HTMLElement>(".bp-cur"), cx = $<HTMLElement>(".bp-cur-x"), cy = $<HTMLElement>(".bp-cur-y"), rd = $<HTMLElement>(".bp-cur-r"), box = $<HTMLElement>(".bp-meas");
    let cRaf = 0, x = 0, y = 0, target: Element | null = null, lastTxt = 0;
    const draw = (now: number) => {
      cRaf = 0;
      if (!cur || !cx || !cy || !rd || !box) return;
      cx.style.transform = `translate3d(${x}px, 0, 0)`;
      cy.style.transform = `translate3d(0, ${y}px, 0)`;
      rd.style.transform = `translate3d(${x + 14}px, ${y + 16}px, 0)`;
      if (now - lastTxt > 40) { lastTxt = now; rd.textContent = `X ${coord(x + scrollX)}  Y ${coord(y + scrollY)}`; }
      if (target) {
        const r = target.getBoundingClientRect();
        box.style.transform = `translate3d(${r.left.toFixed(1)}px, ${r.top.toFixed(1)}px, 0)`;
        box.style.width = `${r.width.toFixed(1)}px`; box.style.height = `${r.height.toFixed(1)}px`;
        box.dataset.w = mm(r.width); box.dataset.h = mm(r.height);
        box.setAttribute("aria-label", dims(r.width, r.height));
      }
    };
    if (cur && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      on(window, "pointermove", (e) => {
        const ev = e as PointerEvent;
        const t = ev.target as Element | null;
        if (ev.pointerType !== "mouse" || calm() || t?.closest?.(CHROME)) { delete cur.dataset.on; return; }
        x = ev.clientX; y = ev.clientY;
        const m = t?.closest?.(MEASURE) ?? null;
        if (m !== target) { target = m; cur.toggleAttribute("data-meas", !!m); }
        cur.dataset.on = "";
        if (!cRaf) cRaf = requestAnimationFrame(draw);
      }, { passive: true });
      on(document.documentElement, "pointerleave", () => { delete cur.dataset.on; });
      on(window, "scroll", () => { if (target && !cRaf) cRaf = requestAnimationFrame(draw); }, { passive: true });
    }

    return () => {
      offs.forEach((f) => f()); plot.disconnect(); ro.disconnect(); clearTimeout(late);
      cancelAnimationFrame(sRaf); cancelAnimationFrame(cRaf); cancelAnimationFrame(hRaf);
      el.removeAttribute("data-bp-armed");
    };
  }, [root, setUniform]);
}
