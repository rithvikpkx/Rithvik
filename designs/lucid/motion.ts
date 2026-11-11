"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { lensFilter, lensKey, radiusPx, strength, type Lens } from "./lens";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** True on Chromium, the only engine that renders an SVG filter as a backdrop; the others get frosted glass. */
const canRefract = () => !!(navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands?.some((b) => /Chrom/.test(b.brand));

// glass that refracts whenever it is on screen (few, and mostly small), glass that bends only under the pointer,
// and everything whose rim catches the pointer's light
const LENS = ".ly-head, .agent-bar, .pt-node, .cl-node, .wk-hub";
const HOVER = ".ab-tile, .ab-play, .ly-btn, .wk-item";
const LIGHT = `${LENS}, ${HOVER}, .qz-face, .ly-st-node, .ab-chip, .ab-go, .ab-seg, .lg-drop, .lg-mail`;
// how each kind of glass is cut: frost (px) keeps text behind a bar legible, bulge is the hover lens
const CUT: [string, { frost: number; split: number }][] = [
  [".ly-head, .agent-bar", { frost: 2.2, split: 3 }],
  [".wk-hub", { frost: 0, split: 6 }],
  ["*", { frost: 0.4, split: 4 }],
];

/** The mockup's mount(), split by concern: lens filters cut per element size and shared (backdrop refraction on
 *  Chromium), the pointer light sliding across every glass rim in view, the liquid droplet under the nav, the goo
 *  membrane joining the contact buttons, and the scroll uniform that lifts the hero's drops. Everything it adds is
 *  removed on unmount (design switch). */
export function useLucidMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const html = document.documentElement, offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const refract = canRefract();
    html.dataset.lg = refract ? "refract" : "frost";

    // ---------- lenses: one <filter> per size class, appended to the design's defs ----------
    const defs = el.querySelector<SVGSVGElement>("#lg-lenses");
    const made = new Map<string, string>();
    const cut = (lens: Lens) => {
      const k = lensKey(lens);
      let id = made.get(k);
      if (!id && defs) { id = `lg-l${made.size}`; made.set(k, id); defs.insertAdjacentHTML("beforeend", lensFilter(id, lens)); }
      return id;
    };
    /** Cuts the rest lens and the hover (bulging) lens for one element at its current size. */
    const fit = (g: HTMLElement, w: number, h: number) => {
      if (!refract || w < 8 || h < 8) return;
      const r = radiusPx(getComputedStyle(g).borderTopLeftRadius, w, h), c = CUT.find(([s]) => s === "*" || g.matches(s))![1];
      const a = cut({ w, h, r, scale: strength(w, h), ...c }), b = cut({ w, h, r, scale: strength(w, h, 1.7), ...c, split: c.split * 1.5 });
      if (a) g.style.setProperty("--lg-f", `url(#${a})`);
      if (b) g.style.setProperty("--lg-fh", `url(#${b})`);
    };
    const ro = new ResizeObserver((en) => en.forEach((e) => { const b = e.borderBoxSize?.[0]; fit(e.target as HTMLElement, b ? b.inlineSize : e.contentRect.width, b ? b.blockSize : e.contentRect.height); }));

    // ---------- the light: rims in view track the pointer ----------
    const lit = new Set<HTMLElement>();
    const io = new IntersectionObserver((en) => en.forEach((e) => (e.isIntersecting ? lit.add(e.target as HTMLElement) : lit.delete(e.target as HTMLElement))));
    const seen = new WeakSet<Element>();
    /** Registers glass (idempotent): light for all, a size-fitted lens for the refracting kinds. */
    const adopt = (g: Element) => {
      if (seen.has(g)) return;
      seen.add(g); io.observe(g);
      if (g.matches(LENS)) ro.observe(g, { box: "border-box" });
    };
    const scan = () => { el.querySelectorAll(LIGHT).forEach(adopt); document.querySelectorAll(".agent-bar").forEach(adopt); };
    scan();
    // the agent dock and some bodies mount late: look again shortly, and adopt anything the pointer finds
    const late = [setTimeout(scan, 1200), setTimeout(scan, 4000)];
    let px = -1e4, py = -1e4, lraf = 0;
    const paint = () => {
      lraf = 0;
      const gs = [...lit], rs = gs.map((g) => g.getBoundingClientRect()); // read everything, then write
      gs.forEach((g, i) => { g.style.setProperty("--lx", `${Math.round(px - rs[i].left)}px`); g.style.setProperty("--ly", `${Math.round(py - rs[i].top)}px`); });
    };
    on(window, "pointermove", (e) => {
      const ev = e as PointerEvent;
      if (ev.pointerType === "touch" || calm()) return;
      px = ev.clientX; py = ev.clientY;
      if (!lraf) lraf = requestAnimationFrame(paint);
    }, { passive: true });
    on(document, "pointerover", (e) => {
      const g = (e.target as Element).closest?.(`${LIGHT}`);
      if (!g) return;
      adopt(g);
      if (g.matches(HOVER) && !(g as HTMLElement).style.getPropertyValue("--lg-fh")) { const r = g.getBoundingClientRect(); fit(g as HTMLElement, (g as HTMLElement).offsetWidth || r.width, (g as HTMLElement).offsetHeight || r.height); }
    }, { passive: true });

    // ---------- scroll: the drops ride up with the hero; the light follows the page ----------
    let sraf = 0;
    const scrolled = () => { sraf = 0; setUniform("u_sy", scrollY / Math.max(1, innerHeight)); if (px > -1e4 && !calm()) paint(); };
    on(window, "scroll", () => { if (!sraf) sraf = requestAnimationFrame(scrolled); }, { passive: true });
    const first = requestAnimationFrame(scrolled);

    // ---------- the nav droplet: a bead of glass that stretches from link to link like liquid ----------
    const nav = el.querySelector<HTMLElement>(".ly-nav");
    const drop = document.createElement("i");
    drop.className = "lg-drop"; drop.setAttribute("aria-hidden", "true");
    let at: HTMLElement | null = null, mo: MutationObserver | undefined;
    if (nav) {
      nav.append(drop);
      adopt(drop);
      const go = (a: HTMLElement | null) => {
        if (a === at) return;
        const from = at; at = a;
        if (!a) { drop.style.opacity = "0"; return; }
        const l1 = a.offsetLeft, w1 = a.offsetWidth;
        drop.style.opacity = "1";
        if (from && !calm()) {
          const l0 = from.offsetLeft, w0 = from.offsetWidth, l = Math.min(l0, l1), w = Math.max(l0 + w0, l1 + w1) - l;
          // the leading edge runs ahead and the bead thins as it stretches, then snaps round at the new link
          drop.animate([{ left: `${l0}px`, width: `${w0}px`, transform: "translateY(-50%) scaleY(1)" },
            { left: `${l}px`, width: `${w}px`, transform: "translateY(-50%) scaleY(.66)", offset: 0.42 },
            { left: `${l1}px`, width: `${w1}px`, transform: "translateY(-50%) scaleY(1)" }], { duration: 620, easing: "cubic-bezier(.3, 1.3, .5, 1)" });
        }
        drop.style.left = `${l1}px`; drop.style.width = `${w1}px`;
      };
      const current = () => nav.querySelector<HTMLElement>("a[aria-current]");
      go(current());
      mo = new MutationObserver(() => { if (!nav.matches(":hover")) go(current()); });
      mo.observe(nav, { attributes: true, subtree: true, attributeFilter: ["aria-current"] });
      on(nav, "pointerover", (e) => { const a = (e.target as Element).closest?.("a"); if (a && (e as PointerEvent).pointerType !== "touch") go(a as HTMLElement); });
      on(nav, "pointerleave", () => go(current()));
    }

    // ---------- the contact membrane: the buttons are drops of one liquid, necking where they come close ----------
    const cl = el.querySelector<HTMLElement>(".cl");
    const NS = "http://www.w3.org/2000/svg";
    let goo: SVGSVGElement | null = null, graf = 0, gvis = false;
    if (cl) {
      goo = document.createElementNS(NS, "svg");
      goo.setAttribute("class", "lg-goo"); goo.setAttribute("aria-hidden", "true");
      const g = document.createElementNS(NS, "g");
      g.setAttribute("filter", "url(#lg-goo-f)");
      const nodes = Array.from(cl.querySelectorAll<HTMLElement>(".cl-node"));
      const blobs = nodes.map(() => g.appendChild(document.createElementNS(NS, "circle")));
      goo.append(g); cl.prepend(goo);
      const draw = () => {
        const s = nodes[0]?.offsetWidth ?? 0, half = s / 2;
        const c = nodes.map((n) => { const [x, y] = n.style.translate.split(" ").map(parseFloat); return [(x || 0) + half, (y || 0) + half]; });
        blobs.forEach((b, i) => { b.setAttribute("cx", c[i][0].toFixed(1)); b.setAttribute("cy", c[i][1].toFixed(1)); b.setAttribute("r", (half * 1.08).toFixed(1)); });
      };
      const tick = () => { graf = 0; draw(); if (gvis && !calm()) graf = requestAnimationFrame(tick); };
      const gio = new IntersectionObserver(([en]) => { gvis = !!en?.isIntersecting; cancelAnimationFrame(graf); graf = 0; if (gvis) graf = requestAnimationFrame(tick); });
      gio.observe(cl);
      offs.push(() => gio.disconnect());
    }

    return () => {
      offs.forEach((f) => f()); late.forEach(clearTimeout);
      ro.disconnect(); io.disconnect(); mo?.disconnect();
      cancelAnimationFrame(lraf); cancelAnimationFrame(sraf); cancelAnimationFrame(first); cancelAnimationFrame(graf);
      drop.remove(); goo?.remove();
      document.querySelectorAll<HTMLElement>(".agent-bar").forEach((b) => { for (const v of ["--lg-f", "--lg-fh", "--lx", "--ly"]) b.style.removeProperty(v); });
      delete html.dataset.lg;
    };
  }, [root, setUniform]);
}
