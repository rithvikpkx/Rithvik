"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { shaderTime, type UniformValue } from "@/lib/shader/runtime";
import { boxToView, spring, strokeKind, toView, type Vec2 } from "./view";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

const GUSTS = 6; // u_g0..u_g5, reused round-robin
const HOLD_MS = 200; // a press longer than this gathers the cloud instead of bursting it
const STROKE = 0.04; // view units between the gusts a drag paints
const SKIP = "a, button, input, textarea, select, label, summary, [contenteditable], .pt-node"; // real controls keep their clicks
const TEXT = ".ly-hero-copy, .ly-contact-k, .ly-contact-h, .ly-contact-s, h2"; // copy stays selectable

/** Flux's mount(): drives the particle shader. Each frame it places the cloud on its anchor (the hero portrait, or the
 *  Contact cloud once the hero is gone), feeds the pointer (live, plus an underdamped lagging copy each point follows
 *  at its own delay), the press-and-hold implosion, gusts from clicks, taps and drags, the name swarm and the scroll
 *  wind. The shader host shows only while the hero or Contact is on screen, so the runtime pauses in between. Calm:
 *  no loop and no input, just one composed still that follows the scroll. Everything is undone on unmount. */
export function useFluxMotion(root: RefObject<HTMLElement | null>) {
  const setU = useShaderUniforms();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const $ = <T extends Element>(s: string) => el.querySelector<T>(s);
    const host = $<HTMLElement>("#fl-gl"), hero = $<HTMLElement>("#top"), contact = $<HTMLElement>("#contact");
    const photo = $<HTMLElement>(".ly-hero .pt-photo"), name = $<HTMLElement>(".ly-name");
    const cloud = $<HTMLElement>("#contact .cl"), head = $<HTMLElement>("#contact .ly-contact-h");
    const offs: (() => void)[] = [];
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const set = (n: string, v: UniformValue) => setU(n, v);

    // page-space boxes, measured on layout changes only, so the frame loop never reads layout
    type Box = { x: number; y: number; w: number; h: number } | null;
    let boxes: Record<"photo" | "name" | "cloud" | "head", Box> = { photo: null, name: null, cloud: null, head: null };
    /** The smallest rect holding all of `rs` (null when empty). */
    const union = (rs: DOMRect[]) => {
      const ok = rs.filter((x) => x.width && x.height);
      if (!ok.length) return null;
      const l = Math.min(...ok.map((x) => x.left)), t = Math.min(...ok.map((x) => x.top));
      return new DOMRect(l, t, Math.max(...ok.map((x) => x.right)) - l, Math.max(...ok.map((x) => x.bottom)) - t);
    };
    /** An element's page box; `text` = the box of its glyphs only (a block heading spans the whole column). */
    const pageBox = (e: HTMLElement | null, text = false): Box => {
      if (!e) return null;
      let r = e.getBoundingClientRect();
      // block parts span the column: union the words (or the text's own line boxes) instead
      if (text) { const ws = e.querySelectorAll(".kn-w"), g = document.createRange(); g.selectNodeContents(e); r = union(ws.length ? Array.from(ws, (w) => w.getBoundingClientRect()) : Array.from(g.getClientRects())) ?? r; }
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    };
    const measure = () => { boxes = { photo: pageBox(photo), name: pageBox(name, true), cloud: pageBox(cloud), head: pageBox(head, true) }; };

    const seen = new Set<string>();
    let raf = 0, last = 0, t0 = performance.now();
    let p: Vec2 = [0, 0], pv: Vec2 = [0, 0], moved = 0;
    let q: Vec2 = [0, 0];
    const qv: Vec2 = [0, 0];
    let pres = 0, presV = 0, presT = 0, hold = 0, holdV = 0, holdT = 0, nk = 0, nkV = 0, nkT = 0, nkUntil = 0;
    let wind = 0, lastY = scrollY, slot = 0, measured = 0;
    let down: { x: number; y: number; t: number; last: Vec2; dragged: boolean; touch: boolean } | null = null, holdTimer = 0;

    /** The anchor box in view units: Contact's cloud when only Contact is on screen, otherwise the hero portrait. */
    const anchor = () => {
      const c = seen.has("contact") && !seen.has("top");
      const b = c ? boxes.cloud : boxes.photo, n = c ? boxes.head : boxes.name;
      const W = innerWidth, H = innerHeight;
      const a = b ? boxToView(b.x - scrollX, b.y - scrollY, b.w, b.h, W, H) : [W / H * 0.5, 0, 0.3, 0.3];
      // the Contact cloud box is wide and short: ring the button cluster, not the whole box
      const r = c ? Math.min(a[2], a[3]) * 0.62 : a[2] * 0.5;
      const nb = n ? boxToView(n.x - scrollX, n.y - scrollY, n.w, n.h, W, H) : [0, 0, 0, 0];
      return { a: [a[0], a[1], r, c ? 1 : 0] as UniformValue, n: nb as UniformValue };
    };
    const place = () => { const { a, n } = anchor(); set("u_a", a); set("u_n", n); };

    /** One frame of springs and uniforms; keeps looping while the host is visible. */
    const frame = (now: number) => {
      raf = 0;
      if (!seen.size || calm()) { last = 0; return; }
      const dt = Math.min(1 / 20, last ? (now - last) / 1000 : 1 / 60); last = now;
      if (now - moved > 50) { const f = Math.exp(-dt * 7); pv = [pv[0] * f, pv[1] * f]; } // a resting pointer loses its speed
      [q[0], qv[0]] = spring(q[0], qv[0], p[0], dt, 26, 6.5);
      [q[1], qv[1]] = spring(q[1], qv[1], p[1], dt, 26, 6.5);
      [pres, presV] = spring(pres, presV, presT, dt, 12, 7);
      [hold, holdV] = spring(hold, holdV, holdT, dt, holdT ? 9 : 30, holdT ? 5 : 7); // gathers slowly, lets go fast
      if (nkUntil && now > nkUntil) { nkUntil = 0; nkT = 0; }
      [nk, nkV] = spring(nk, nkV, nkT, dt, 10, 5.5);
      const sy = scrollY; wind += (((lastY - sy) / innerHeight) * 2 / dt - wind) * Math.min(1, dt * 8); lastY = sy;
      wind *= Math.exp(-dt * 3);
      place();
      set("u_p", [p[0], p[1], Math.max(-6, Math.min(6, pv[0])), Math.max(-6, Math.min(6, pv[1]))]);
      set("u_q", [q[0], q[1], Math.max(0, hold), Math.max(0, Math.min(1, pres))]);
      set("u_k", [Math.max(0, nk), wind, Math.min(1, (now - t0) / 1800), 0]);
      raf = requestAnimationFrame(frame);
    };
    const wake = () => { if (!raf && seen.size && !calm()) raf = requestAnimationFrame(frame); };

    /** Stamps one gust in the next slot: 0 burst, 1 implosion, 2+angle a stroke. */
    const gust = (at: Vec2, kind: number) => { set(`u_g${slot}`, [at[0], at[1], shaderTime(), kind]); slot = (slot + 1) % GUSTS; };
    const view = (e: PointerEvent): Vec2 => toView(e.clientX, e.clientY, innerWidth, innerHeight);
    const inName = (v: Vec2) => {
      const n = (anchor().n as number[]);
      return n[2] > 0 && Math.abs(v[0] - n[0]) < n[2] + 0.08 && Math.abs(v[1] - n[1]) < n[3] + 0.08;
    };

    on(window, "pointermove", (ev) => {
      const e = ev as PointerEvent;
      if (calm() || !seen.size) return;
      const v = view(e), dt = Math.max(8, e.timeStamp - moved) / 1000;
      if (e.timeStamp - measured > 1000) { measured = e.timeStamp; measure(); } // cheap insurance against late font swaps
      if (e.pointerType !== "touch") {
        const k = moved ? 0.35 : 0;
        pv = [pv[0] * (1 - k) + ((v[0] - p[0]) / dt) * k, pv[1] * (1 - k) + ((v[1] - p[1]) / dt) * k];
        if (!presT) { q = [...v]; } // first contact: no fly-in from a stale position
        presT = 1;
        nkT = inName(v) ? 1 : nkUntil ? nkT : 0;
      }
      p = v; moved = e.timeStamp;
      if (down && !down.touch) {
        const dx = v[0] - down.last[0], dy = v[1] - down.last[1];
        if (Math.hypot(dx, dy) > STROKE) {
          gust(v, strokeKind(dx, dy)); down.last = v;
          if (!down.dragged) { down.dragged = true; clearTimeout(holdTimer); holdT = 0; }
        }
      }
      wake();
    }, { passive: true });
    on(document.documentElement, "pointerleave", () => { presT = 0; nkT = 0; wake(); });

    const press = (ev: Event) => {
      const e = ev as PointerEvent;
      const tg = e.target as Element;
      if (calm() || e.button > 0 || tg.closest?.(SKIP) || tg.closest?.(TEXT)) return;
      const v = view(e), touch = e.pointerType !== "mouse" && e.pointerType !== "pen";
      p = v;
      if (touch) { // a tap: a burst, and the name swarms briefly if it was the name
        q = [...v]; presT = 0; gust(v, 0);
        if (inName(v)) { nkT = 1; nkUntil = performance.now() + 1400; }
        wake(); return;
      }
      e.preventDefault(); // a drag from empty space paints the cloud; it must not start a text selection
      down = { x: v[0], y: v[1], t: e.timeStamp, last: v, dragged: false, touch };
      holdTimer = window.setTimeout(() => { if (down && !down.dragged) { holdT = 1; wake(); } }, HOLD_MS);
      wake();
    };
    const release = () => {
      if (!down) return;
      clearTimeout(holdTimer);
      if (!down.dragged) gust(p, 0); // a click bursts; letting go of a hold bursts the gathered knot
      down = null; holdT = 0; wake();
    };
    on(hero, "pointerdown", press); on(contact, "pointerdown", press);
    on(window, "pointerup", release); on(window, "pointercancel", release);
    on(window, "blur", release);

    // the host shows only while the hero or Contact is on screen; the runtime pauses when it is hidden
    const io = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      if (host) host.style.display = seen.size ? "" : "none";
      measure(); place(); wake();
    }, { threshold: 0 });
    [hero, contact].forEach((s) => s && io.observe(s));
    const ro = new ResizeObserver(() => { measure(); place(); });
    ro.observe(el);
    let sraf = 0;
    // calm: the still follows the page (each uniform write asks the runtime for one fresh frame)
    on(window, "scroll", () => { if (calm() && !sraf) sraf = requestAnimationFrame(() => { sraf = 0; place(); }); else wake(); }, { passive: true });
    on(window, "resize", () => { measure(); place(); }, { passive: true });
    document.fonts?.ready.then(() => { measure(); place(); });

    for (let i = 0; i < GUSTS; i++) set(`u_g${i}`, [0, 0, -100, 0]);
    measure(); place();
    set("u_p", [0, 0, 0, 0]); set("u_q", [0, 0, 0, 0]);
    set("u_k", [0, 0, calm() ? 1 : 0, 0]);
    t0 = performance.now();
    // performance mode toggled live: a calm still is fully formed
    const mo = new MutationObserver(() => { if (calm()) set("u_k", [0, 0, 1, 0]); else { t0 = performance.now() - 1800; wake(); } });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      offs.forEach((f) => f()); io.disconnect(); ro.disconnect(); mo.disconnect();
      cancelAnimationFrame(raf); cancelAnimationFrame(sraf); clearTimeout(holdTimer);
      if (host) host.style.display = "";
    };
  }, [root, setU]);
}

