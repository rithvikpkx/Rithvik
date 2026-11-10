"use client";
import { useEffect, type RefObject } from "react";
import { K, KG_CLS, hashStr, pad } from "./vision";

export const MAX_BOXES = 6;
export const SLICE_COLORS = ["#E0103F", "#1F3BFF", "#F0F921", "#7E03A8", "#00875A", "#E0457B", "#0C0D0F"];
const FIXED: Record<string, number> = { person: 0.97, name: 0.99, ouroboros: 0.99 };
const SEL = "[data-tk], .kg-node[data-type]";

type R = { x: number; y: number; w: number; h: number }; // document coordinates
type Box = {
  el: HTMLElement; e: HTMLElement[]; c: HTMLElement[]; lid: HTMLElement; ltx: HTMLElement;
  t: HTMLElement | null; role: string | null; x: number; y: number; w: number; h: number; a: number;
  born: number; conf: number; base: number; txt: string; id: number; lost: number;
};

/** The mockup's mount(): the box tracker, the optical-flow field and the HUD. Target rects are cached in
 *  document coordinates (re-read only on resize/layout change, or for the hovered element), so each frame
 *  is pure arithmetic on scrollY followed by transform writes: no layout reads inside the loop. The loop runs
 *  only while something moves, never under html.lite, and snaps instead of easing under reduced motion. */
export function useTrackerMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    const offs: (() => void)[] = [];
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const $ = <T extends Element>(s: string) => root.querySelector<T>(s);
    const lite = () => html.classList.contains("lite");
    const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
    const flow = $<SVGSVGElement>(".tk-flow"), flowPath = flow?.firstElementChild as SVGPathElement | null;
    const hud = { st: $("[data-tk-state]"), fps: $("[data-tk-fps]"), fr: $("[data-tk-frame]"), obj: $("[data-tk-obj]") };
    const photo = $<HTMLElement>(".pt-photo");
    if (photo) { photo.dataset.tk = "person"; photo.dataset.tkLabel = "person"; }
    root.querySelectorAll<HTMLElement>(".ly-st").forEach((el) => { el.dataset.tk = "role"; }); // the shared Experience stations
    const AMBIENT = innerWidth < 700 ? 1 : 2;

    const boxes: Box[] = Array.from(root.querySelectorAll<HTMLElement>(".tk-box"), (el) => {
      const q = el.children as HTMLCollectionOf<HTMLElement>, lbl = q[8];
      return { el, e: [q[0], q[1], q[2], q[3]], c: [q[4], q[5], q[6], q[7]], lid: lbl.firstElementChild as HTMLElement, ltx: lbl.lastElementChild as HTMLElement, t: null, role: null, x: 0, y: 0, w: 0, h: 0, a: 0, born: 0, conf: 0, base: 0, txt: "", id: 0, lost: 0 };
    });
    const lbls = boxes.map((b) => b.el.children[8] as HTMLElement);
    const slices = Array.from(root.querySelectorAll<HTMLElement>(".tk-slice"));

    // rect cache: one batched read pass whenever layout can have changed
    const rects = new Map<Element, R>();
    const measure = (el: Element) => { const r = el.getBoundingClientRect(); const v = { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; rects.set(el, v); return v; };
    let ambientEls: HTMLElement[] = [];
    const remeasure = () => {
      rects.clear();
      ambientEls = Array.from(root.querySelectorAll<HTMLElement>("[data-tk]")).filter((el) => el !== photo);
      ambientEls.forEach(measure);
      if (photo) measure(photo);
      boxes.forEach((b) => { if (b.t && !rects.has(b.t)) measure(b.t); });
      wake();
    };
    const rectOf = (el: Element) => rects.get(el) ?? measure(el);
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(root);
    on(window, "resize", () => remeasure(), { passive: true });
    document.fonts?.ready.then(() => { if (root.isConnected) remeasure(); });

    let nextId = 1, linger = false;
    const cool = new WeakMap<Element, number>();
    const isKg = (el: HTMLElement) => el.classList.contains("kg-node");
    const clsOf = (el: HTMLElement) => (isKg(el) ? KG_CLS[el.dataset.type!] ?? "node" : el.dataset.tk!);
    const labelOf = (el: HTMLElement) => (isKg(el) ? KG_CLS[el.dataset.type!] ?? "node" : el.dataset.tkLabel || el.dataset.tk!);
    const baseConf = (el: HTMLElement) => FIXED[labelOf(el)] || 0.81 + (hashStr((el.textContent || el.dataset.id || "") + labelOf(el)) % 170) / 1000;
    const padOf = (b: Box) => (b.role === "person" ? 10 : b.t && isKg(b.t) ? 7 : 6);
    const setText = (b: Box, s: string) => { if (b.txt !== s) { b.txt = s; b.ltx.textContent = s; } };
    const release = (b: Box) => { b.t = null; b.role = null; };

    /** Point a box at a new target; a handover keeps its current geometry so it slides across. */
    function assign(b: Box, el: HTMLElement, role: string, now: number, handover: boolean) {
      const fresh = !b.t || !handover;
      b.t = el; b.role = role; b.id = nextId++; b.base = baseConf(el); b.conf = 0.32; b.born = now; b.lost = 0;
      b.el.style.setProperty("--k", K[clsOf(el)] || "#1F3BFF"); // a small box, set once per acquisition
      b.el.classList.toggle("is-lock", role === "pointer");
      if (fresh) { const r = rectOf(el), p = 22; b.x = r.x - scrollX - p; b.y = r.y - scrollY - p; b.w = r.w + p * 2; b.h = r.h + p * 2; b.a = 0; }
      b.lid.textContent = "#" + pad(b.id); b.txt = ""; setText(b, "acquiring");
    }

    // pointer: whatever candidate is under the mouse becomes the locked target; the box hands over between them
    let pointerEl: HTMLElement | null = null, pointerT = 0;
    on(root, "pointerover", (ev) => {
      const e = ev as PointerEvent;
      if (e.pointerType !== "mouse" || lite()) return;
      const el = (e.target as Element).closest<HTMLElement>(SEL);
      if (!el || !root.contains(el) || el.dataset.tk === "person") return;
      measure(el); pointerEl = el; pointerT = performance.now(); wake();
    });
    // a click hands the element to the visitor (a case, a graph card); the tracker steps back
    on(root, "click", (e) => { if ((e.target as Element).closest(".kg, [data-case], [data-play]")) { pointerEl = null; pointerT = 0; wake(); } });
    on(root, "pointerout", (ev) => {
      const e = ev as PointerEvent;
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element).closest(SEL);
      if (el && el === pointerEl && !el.contains(e.relatedTarget as Node | null)) { pointerEl = null; pointerT = performance.now(); wake(); }
    });

    // scroll velocity feeds the flow field and wakes the tracker
    let lastY = scrollY, lastS = performance.now(), vel = 0, flowA = 0, lastScrollT = 0;
    on(window, "scroll", () => {
      const now = performance.now(), dt = Math.max(8, now - lastS);
      vel = vel * 0.55 + ((scrollY - lastY) / dt) * 0.45; lastY = scrollY; lastS = now; lastScrollT = now; wake();
    }, { passive: true });

    /** Choose targets from cached rects: the person while visible, the pointer target, and up to two ambient
     *  ones near mid-screen, never right next to another tracked thing (adjacent boxes read as clutter). */
    function choose(now: number) {
      const vh = innerHeight, vw = innerWidth, sy = scrollY;
      const vr = (el: Element) => { const r = rectOf(el); return { left: r.x - scrollX, top: r.y - sy, right: r.x - scrollX + r.w, bottom: r.y - sy + r.h, h: r.h, w: r.w }; };
      const want: [HTMLElement, string][] = [];
      if (photo) { const r = vr(photo); if (r.bottom > 40 && r.top < vh - 40) want.push([photo, "person"]); }
      if (pointerEl?.isConnected) want.push([pointerEl, "pointer"]);
      const taken = want.map(([el]) => vr(el));
      const clear = (r: ReturnType<typeof vr>) => taken.every((q) => r.right + 40 < q.left || q.right + 40 < r.left || r.bottom + 48 < q.top || q.bottom + 48 < r.top);
      const amb: HTMLElement[] = [];
      boxes.forEach((b) => {
        if (b.role !== "ambient" || !b.t || b.lost || b.t === pointerEl || amb.length >= AMBIENT) return;
        const r = vr(b.t);
        if (r.bottom > vh * 0.08 && r.top < vh * 0.9 && r.h < vh * 0.8 && clear(r)) { amb.push(b.t); taken.push(r); }
      });
      if (amb.length < AMBIENT) {
        const cands: [number, HTMLElement, ReturnType<typeof vr>][] = [];
        ambientEls.forEach((el) => {
          if (el === pointerEl || amb.includes(el) || (cool.get(el) || 0) > now) return;
          const r = vr(el);
          if (r.h < 8 || r.h > vh * 0.62 || r.w > vw * 0.98 || r.top < vh * 0.16 || r.bottom > vh * 0.86) return;
          cands.push([Math.abs(r.top + r.h / 2 - vh * 0.5) + (r.w > vw * 0.7 ? vh * 0.12 : 0), el, r]);
        });
        cands.sort((a, b) => a[0] - b[0]);
        for (const [, el, r] of cands) { if (amb.length >= AMBIENT) break; if (!clear(r)) continue; amb.push(el); taken.push(r); }
      }
      amb.forEach((el) => want.push([el, "ambient"]));
      want.splice(MAX_BOXES);
      // release boxes whose target is no longer wanted (the pointer box lingers a moment, like a tracker's memory)
      linger = false;
      boxes.forEach((b) => {
        if (!b.t || b.lost) return;
        const w = want.find(([el]) => el === b.t);
        if (w) { if (w[1] !== b.role) { b.role = w[1]; b.el.classList.toggle("is-lock", w[1] === "pointer"); } return; }
        if (b.role === "pointer" && now - pointerT < 700 && b.t.isConnected) { linger = true; return; }
        release(b);
      });
      // assign the rest; the pointer box is reused so it slides from the last hovered thing to the next
      want.forEach(([el, role]) => {
        if (boxes.some((b) => b.t === el && !b.lost)) return;
        let b = role === "pointer" ? boxes.find((x) => x.role === "pointer" && x.t && !x.lost) : undefined;
        const hand = !!b;
        if (!b) b = boxes.find((x) => !x.t && x.a < 0.05) || boxes.find((x) => !x.t);
        if (b) assign(b, el, role, now, hand && !reduce());
      });
    }

    /** Lose one ambient target: datamosh slices over its box, a new ID when it comes back. */
    function lose(now: number) {
      if (lite() || reduce() || document.hidden) return;
      const b = boxes.find((x) => x.role === "ambient" && x.t && !x.lost && now - x.born > 2200);
      if (!b || !b.t) return;
      b.lost = now; setText(b, "lost"); b.el.classList.add("is-lost"); cool.set(b.t, now + 1500);
      slices.forEach((s, i) => {
        const y = b.y + Math.random() * b.h, x = b.x - 10 + Math.random() * 30, w = b.w * (0.3 + Math.random() * 0.8), h = 2 + Math.random() * (i % 3 ? 6 : 14);
        s.animate([
          { transform: `translate(${x}px, ${y}px) scale(${w / 100}, ${h / 10})`, opacity: 0.9 },
          { transform: `translate(${x + (Math.random() - 0.5) * 60}px, ${y}px) scale(${w / 100}, ${h / 10})`, opacity: 0.75, offset: 0.4 },
          { transform: `translate(${x + (Math.random() - 0.5) * 120}px, ${y + (Math.random() - 0.5) * 12}px) scale(${(w * 0.6) / 100}, ${h / 10})`, opacity: 0 },
        ], { duration: 260 + i * 30, easing: "steps(5, end)", delay: i * 12 });
      });
      wake();
    }
    let loseT = 0;
    const scheduleLose = () => { loseT = window.setTimeout(() => { lose(performance.now()); scheduleLose(); }, 7000 + Math.random() * 6000); };
    scheduleLose();

    /** A sparse grid of arrows (one SVG path), drawn only while scrolling fast. Returns whether it is visible. */
    function drawFlow(now: number) {
      if (!flow || !flowPath) return false;
      const fast = Math.abs(vel) > 1.1 && now - lastScrollT < 120 && !reduce();
      flowA += ((fast ? 1 : 0) - flowA) * (fast ? 0.35 : 0.16);
      if (flowA < 0.02) { if (flow.style.opacity !== "0") { flow.style.opacity = "0"; flowPath.setAttribute("d", ""); } return false; }
      const vw = innerWidth, vh = innerHeight, gap = vw < 700 ? 64 : 92, mag = Math.min(26, Math.abs(vel) * 7), dir = vel > 0 ? -1 : 1, t = now / 1000;
      let d = "";
      for (let y = gap * 0.75; y < vh; y += gap) for (let x = gap / 2; x < vw; x += gap) {
        const n = Math.sin(x * 0.013 + t * 1.7) * Math.cos(y * 0.011 - t * 1.3), ang = n * 0.42, m = mag * (0.55 + 0.45 * Math.abs(Math.sin(x * 0.02 + y * 0.017)));
        if (m < 3) continue;
        const dx = Math.sin(ang) * m, dy = dir * Math.cos(ang) * m, ex = x + dx, ey = y + dy, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, hs = Math.min(5, m * 0.35);
        d += `M${x.toFixed(1)} ${y.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}M${(ex - ux * hs - uy * hs * 0.6).toFixed(1)} ${(ey - uy * hs + ux * hs * 0.6).toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}L${(ex - ux * hs + uy * hs * 0.6).toFixed(1)} ${(ey - uy * hs - ux * hs * 0.6).toFixed(1)}`;
      }
      flowPath.setAttribute("d", d); flow.style.opacity = (flowA * 0.62).toFixed(3);
      return true;
    }

    /* the loop: only while something is moving */
    let raf = 0, frame = 0, fps = 60, lastF = 0, wakeT = 0;
    function wake() { if (lite() || document.hidden) return; wakeT = performance.now(); if (!raf) { lastF = 0; raf = requestAnimationFrame(step); } }
    function hideAll() { boxes.forEach((b) => { release(b); b.a = 0; b.el.style.opacity = "0"; }); }
    function step(now: number) {
      raf = 0;
      if (lite()) { hideAll(); return; }
      if (lastF) { const dt = now - lastF; if (dt > 0 && dt < 250) fps += (1000 / dt - fps) * 0.08; }
      lastF = now; frame++;
      // reads first: the hovered element may be mid hover-transition, so refresh just that one rect
      if (pointerEl && frame % 4 === 0) measure(pointerEl);
      if (frame % 4 === 1) choose(now);
      const snap = reduce(), k = snap ? 1 : 0.2, sx = scrollX, sy = scrollY, vh = innerHeight, vw = innerWidth;
      let busy = false, n = 0;
      // then writes: transforms on the small fixed overlay elements only
      boxes.forEach((b, bi) => {
        if (b.t && !b.t.isConnected) release(b);
        if (b.lost && now - b.lost > 420) { b.el.classList.remove("is-lost"); b.lost = 0; release(b); }
        if (b.t) {
          const r = rectOf(b.t), p = padOf(b), jit = b.lost ? 4 : 0;
          const tx = r.x - sx - p + (Math.random() - 0.5) * jit, ty = r.y - sy - p + (Math.random() - 0.5) * jit, tw = r.w + p * 2, th = r.h + p * 2;
          b.x += (tx - b.x) * k; b.y += (ty - b.y) * k; b.w += (tw - b.w) * k; b.h += (th - b.h) * k;
          if (Math.abs(tx - b.x) + Math.abs(ty - b.y) + Math.abs(tw - b.w) + Math.abs(th - b.h) > 0.6) busy = true;
          if (b.y + b.h > 0 && b.y < vh) n++;
          // confidence climbs while it locks on, then breathes a little
          const age = now - b.born;
          if (!b.lost) {
            if (age < 240 && !snap) setText(b, "acquiring");
            else {
              if (age < 700) busy = true;
              b.conf += (b.base - b.conf) * (snap ? 1 : 0.18);
              if (frame % 14 === 0) b.conf = b.base + (Math.random() - 0.5) * 0.02;
              setText(b, `${labelOf(b.t)} ${Math.min(0.99, b.conf).toFixed(2)}`);
            }
          }
        }
        const ta = b.t ? (b.lost ? 0.45 : 1) : 0;
        b.a += (ta - b.a) * (snap ? 1 : 0.22);
        if (Math.abs(ta - b.a) > 0.02) busy = true; else b.a = ta;
        if (b.a <= 0.001 && !b.t) { if (b.el.style.opacity !== "0") b.el.style.opacity = "0"; return; }
        b.el.style.opacity = b.a.toFixed(3);
        const x = b.x, y = b.y, w = Math.max(2, b.w), h = Math.max(2, b.h);
        b.e[0].style.transform = `translate(${x}px, ${y}px) scaleX(${w / 100})`;
        b.e[1].style.transform = `translate(${x}px, ${y + h - 1}px) scaleX(${w / 100})`;
        b.e[2].style.transform = `translate(${x}px, ${y}px) scaleY(${h / 100})`;
        b.e[3].style.transform = `translate(${x + w - 1}px, ${y}px) scaleY(${h / 100})`;
        b.c[0].style.transform = `translate(${x - 1}px, ${y - 1}px)`;
        b.c[1].style.transform = `translate(${x + w - 11}px, ${y - 1}px)`;
        b.c[2].style.transform = `translate(${x - 1}px, ${y + h - 11}px)`;
        b.c[3].style.transform = `translate(${x + w - 11}px, ${y + h - 11}px)`;
        // the label sits outside the top-left corner, or tucks inside when the box touches the top
        lbls[bi].style.transform = `translate(${Math.max(4, Math.min(x - 1, vw - 150))}px, ${y < 82 ? y + 3 : y - 19}px)`;
      });
      const flowing = drawFlow(now);
      if (frame % 6 === 0 || !busy) {
        if (hud.fps) hud.fps.textContent = Math.min(120, fps).toFixed(1);
        if (hud.fr) hud.fr.textContent = pad(frame % 1e6, 6);
        if (hud.obj) hud.obj.textContent = String(n);
        if (hud.st) hud.st.textContent = boxes.some((b) => b.lost) ? "lost 1" : "tracking";
      }
      if (busy || flowing || linger || now - wakeT < 650) raf = requestAnimationFrame(step);
      else if (hud.st) hud.st.textContent = "idle";
      root!.classList.toggle("tk-busy", !!raf);
    }

    // follow performance mode as it is toggled; the CSS swaps boxes for static annotations
    const still = () => { if (hud.st) hud.st.textContent = "static"; if (hud.obj) hud.obj.textContent = "4"; root.classList.remove("tk-busy"); };
    let wasLite = lite();
    if (wasLite) still();
    const mo = new MutationObserver(() => {
      if (lite() === wasLite) return;
      wasLite = lite();
      if (wasLite) { still(); cancelAnimationFrame(raf); raf = 0; hideAll(); if (flow) flow.style.opacity = "0"; } else wake();
    });
    mo.observe(html, { attributes: true, attributeFilter: ["class"] });
    on(document, "visibilitychange", () => { if (!document.hidden) wake(); });

    // first frame: lock onto the person and the name
    const first = requestAnimationFrame(() => wake());

    return () => {
      offs.forEach((f) => f()); ro.disconnect(); mo.disconnect();
      cancelAnimationFrame(raf); cancelAnimationFrame(first); clearTimeout(loseT);
      slices.forEach((s) => s.getAnimations().forEach((a) => a.cancel()));
      root.classList.remove("tk-busy");
    };
  }, [rootRef]);
}
