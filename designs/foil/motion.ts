"use client";
import { useEffect, useRef, type RefObject } from "react";

/** The pastel interference ramp shared by the datamosh streaks and the nav mark gradient. */
export const FOIL = ["#8BF0D3", "#94D4FF", "#B9A8FF", "#FFB3DA", "#FFD79E"];

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lite = () => document.documentElement.classList.contains("lite");
const prm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
/** Calm = reduced motion or performance mode; read live so toggling takes effect at once. */
const calm = () => prm() || lite();

/** The mockup's mount(): hero card tilt (behind the portrait) + shader light, foil-mark sheen, project card
 *  hover tilt, datamosh into the case sheet. Pointer-driven transforms touch only the card elements;
 *  everything is undone on unmount (design switch). */
export function useFoilMotion(root: RefObject<HTMLElement | null>, openCase: (slug: string) => void) {
  const open = useRef(openCase);
  useEffect(() => { open.current = openCase; });

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const $$ = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const fine = () => matchMedia("(hover: hover) and (pointer: fine)").matches;

    /* hero card: springs toward the pointer; the same pose drives the glare and the lenticular strip */
    const hero = $<HTMLElement>(".ly-hero"), wrap = $<HTMLElement>(".fo-hero-card"), tilt = $<HTMLElement>("#fo-tilt"), lent = $<HTMLElement>("#fo-lent");
    if (!hero || !wrap || !tilt) return;
    const S = { x: 0, y: 0, tx: 0, ty: 0, k: 0, kt: 0, raf: 0, intro: 0, heroOn: true };
    const reset = () => { tilt.style.transform = ""; tilt.style.removeProperty("--gx"); tilt.style.removeProperty("--gy"); lent?.style.removeProperty("--k"); };
    function pose() {
      const amp = prm() ? 0.3 : 1;
      tilt!.style.transform = `rotateX(${(-S.y * 9 * amp).toFixed(2)}deg) rotateY(${(S.x * 13 * amp).toFixed(2)}deg)`;
      tilt!.style.setProperty("--gx", (50 + S.x * 46).toFixed(1) + "%");
      tilt!.style.setProperty("--gy", (40 + S.y * 46).toFixed(1) + "%");
      lent?.style.setProperty("--k", sstep(0, 1, S.k).toFixed(3));
    }
    // a lenticular flips at an angle: past ~a third of the way right it shows the role (with a little hysteresis)
    const flip = () => { if (S.kt === 0 && S.x > 0.34) S.kt = 1; else if (S.kt === 1 && S.x < 0.24) S.kt = 0; };
    function step() {
      S.raf = 0;
      S.x += (S.tx - S.x) * 0.12; S.y += (S.ty - S.y) * 0.12;
      flip(); S.k += (S.kt - S.k) * 0.2; if (Math.abs(S.kt - S.k) < 0.004) S.k = S.kt;
      pose();
      if (Math.abs(S.tx - S.x) > 0.002 || Math.abs(S.ty - S.y) > 0.002 || S.k !== S.kt) S.raf = requestAnimationFrame(step);
    }
    const kickTilt = () => { if (!S.raf) S.raf = requestAnimationFrame(step); };
    const aim = (cx: number, cy: number) => {
      const r = wrap.getBoundingClientRect(), ox = r.left + r.width / 2, oy = r.top + r.height / 2;
      S.tx = clamp((cx - ox) / (r.width * 0.9), -1, 1); S.ty = clamp((cy - oy) / (r.height * 0.75), -1, 1);
    };
    // the hero's ambient work only runs while it is on screen
    const io = new IntersectionObserver((en) => { S.heroOn = en[0].isIntersecting; }, { rootMargin: "80px" });
    io.observe(hero);

    let gRaf = 0, gx = 0.5, gy = 0.5;
    const grad = $<SVGLinearGradientElement>("#fo-foil"), fms = $$<HTMLElement>(".fo-fm");
    // the intro dispatches synthetic pointermoves to steer the shader light; the handlers ignore them
    function stopIntro() { if (S.intro) { cancelAnimationFrame(S.intro); S.intro = 0; } }
    on(window, "pointermove", (ev) => {
      const e = ev as PointerEvent;
      if (!e.isTrusted) return;
      if (lite()) { if (tilt.style.transform) reset(); return; }
      // the foil-stamped nav mark turns its sheen with the pointer
      gx = e.clientX / Math.max(1, innerWidth); gy = e.clientY / Math.max(1, innerHeight);
      if (!gRaf) gRaf = requestAnimationFrame(() => {
        gRaf = 0;
        grad?.setAttribute("gradientTransform", `rotate(${Math.round(gx * 160 - 40)} .5 .5)`);
        fms.forEach((m) => { m.style.setProperty("--fx", (gx - 0.5).toFixed(3)); m.style.setProperty("--fy", (gy - 0.5).toFixed(3)); });
      });
      if (!S.heroOn) return;
      if (e.pointerType !== "mouse" && !(e.target as Element | null)?.closest?.(".fo-tilt")) return;
      stopIntro();
      aim(e.clientX, e.clientY); kickTilt();
    }, { passive: true });
    const settle = () => { if (lite()) return; S.tx = 0; S.ty = 0; kickTilt(); };
    on(document.documentElement, "pointerleave", settle);
    on(tilt, "pointerup", (e) => { if ((e as PointerEvent).pointerType !== "mouse") settle(); });
    on(tilt, "pointercancel", settle);

    // first visit to the hero: one slow sweep so everyone sees the foil shift and the strip flip
    function intro() {
      if (calm()) return;
      const t0 = performance.now(), D = 2800;
      const f = (now: number) => {
        if (calm()) { S.intro = 0; reset(); return; }
        const u = Math.min(1, (now - t0) / D), env = Math.sin(Math.PI * u);
        S.tx = S.x = 0.95 * Math.sin(2 * Math.PI * u * 0.95) * env;
        S.ty = S.y = -0.35 * Math.sin(Math.PI * u * 2) * env;
        flip(); S.k += (S.kt - S.k) * 0.2;
        pose();
        // steer the shader's light along the same path (the runtime reads pointer position from window)
        const r = wrap!.getBoundingClientRect();
        window.dispatchEvent(new PointerEvent("pointermove", { clientX: r.left + r.width / 2 + S.x * r.width * 0.55, clientY: r.top + r.height / 2 + S.y * r.height * 0.5 }));
        if (u < 1) S.intro = requestAnimationFrame(f); else { S.intro = 0; S.tx = S.ty = 0; kickTilt(); }
      };
      S.intro = requestAnimationFrame(f);
    }
    const introT = setTimeout(intro, 700);

    /* project cards: a few degrees of tilt and a sliding holo layer while hovered (fine pointers only) */
    const set = $<HTMLElement>("#fo-set");
    let cRaf = 0, cEv: PointerEvent | null = null;
    const cardMove = () => {
      cRaf = 0; const e = cEv; if (!e) return;
      const c = (e.target as Element | null)?.closest?.<HTMLElement>(".fo-pc"); if (!c) return;
      const r = c.parentElement!.getBoundingClientRect();
      c.style.setProperty("--dx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      c.style.setProperty("--dy", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    on(set, "pointermove", (e) => { if (calm() || !fine()) return; cEv = e as PointerEvent; if (!cRaf) cRaf = requestAnimationFrame(cardMove); }, { passive: true });
    on(set, "pointerout", (ev) => {
      const e = ev as PointerEvent, c = (e.target as Element).closest<HTMLElement>(".fo-pc");
      if (c && !c.contains(e.relatedTarget as Node | null)) { c.style.removeProperty("--dx"); c.style.removeProperty("--dy"); }
    });

    /* datamosh: streaks pixel-sort out of the clicked card, then the case sheet rises over them */
    const mosh = $<HTMLElement>(".fo-mosh");
    let moshT: ReturnType<typeof setTimeout>[] = [];
    function openWithMosh(card: HTMLElement, slug: string) {
      if (calm() || !mosh) { open.current(slug); return; }
      moshT.forEach(clearTimeout); moshT = [];
      const r = card.getBoundingClientRect(), W = innerWidth, n = 24, frag = document.createDocumentFragment();
      mosh.innerHTML = "";
      for (let i = 0; i < n; i++) {
        const s = document.createElement("i"), h = 2 + Math.random() ** 2 * 34, top = r.top + Math.random() * r.height - h / 2;
        const right = Math.random() > 0.3, a = FOIL[(Math.random() * FOIL.length) | 0], b = FOIL[(Math.random() * FOIL.length) | 0];
        s.style.cssText = `top:${top.toFixed(1)}px;left:${r.left.toFixed(1)}px;width:${r.width.toFixed(1)}px;height:${h.toFixed(1)}px;transform-origin:${right ? "0" : "100%"} 50%;background:linear-gradient(${right ? 90 : 270}deg, ${a}, ${b} 38%, rgba(10,10,16,.0))`;
        const dist = right ? (W - r.right) * (0.4 + Math.random() * 0.7) : -r.left * (0.4 + Math.random() * 0.7);
        s.animate([
          { transform: "translateX(0) scaleX(.2)", opacity: 0 },
          { transform: `translateX(${(dist * 0.35).toFixed(0)}px) scaleX(${(1 + Math.random()).toFixed(2)})`, opacity: 1, offset: 0.25 },
          { transform: `translateX(${dist.toFixed(0)}px) scaleX(${(1.4 + Math.random() * 2.2).toFixed(2)})`, opacity: 0.9, offset: 0.7 },
          { transform: `translateX(${(dist * 1.1).toFixed(0)}px) scaleX(2.6)`, opacity: 0 },
        ], { duration: 760, delay: Math.random() * 110, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" });
        frag.appendChild(s);
      }
      mosh.appendChild(frag); mosh.hidden = false; card.classList.add("is-mosh");
      moshT.push(setTimeout(() => open.current(slug), 320));
      moshT.push(setTimeout(() => { mosh.hidden = true; mosh.innerHTML = ""; card.classList.remove("is-mosh"); }, 980));
    }
    on(el, "click", (ev) => {
      const e = ev as MouseEvent, c = (e.target as Element).closest<HTMLElement>("[data-fo-case]");
      if (!c || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); openWithMosh(c, c.dataset.foCase!);
    });

    return () => {
      offs.forEach((f) => f()); io.disconnect(); clearTimeout(introT); stopIntro();
      cancelAnimationFrame(S.raf); cancelAnimationFrame(gRaf); cancelAnimationFrame(cRaf); moshT.forEach(clearTimeout);
    };
  }, [root]);
}
