"use client";
import { useEffect, useRef, type RefObject } from "react";
import { kick } from "@/lib/shader/runtime";
import { useSite } from "@/components/site/SiteProvider";
import { ASKS, GLY, QUIPS, SECTIONS } from "./data";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** The mockup's mount(): active tmux window, vim-style keys, the typing prompt, glyph decode on headings,
 *  and the still-shader redraw. `toggleKeys(v?)` flips the shortcuts card. Everything is undone on unmount. */
export function useGlyphMotion(rootRef: RefObject<HTMLElement | null>, toggleKeys: (v?: boolean) => void) {
  // the site context changes identity with every overlay/toast; a ref keeps the effect (decode, typing) from restarting
  const live = useSite();
  const site = useRef(live);
  useEffect(() => { site.current = live; });
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const html = document.documentElement;
    const offs: (() => void)[] = [], timers = new Set<ReturnType<typeof setTimeout>>();
    const on = (t: EventTarget, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };
    const later = (fn: () => void, ms: number) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
    const $$ = <T extends HTMLElement>(s: string) => Array.from(root.querySelectorAll<T>(s));
    const top = $("#top");
    const secs = SECTIONS.map(([id]) => root.querySelector<HTMLElement>("#" + id) ?? top);
    const wins = $$(".gl-wins [data-gl-go]");
    const msg = $("#gl-msg");
    let tops: number[] = [], active = -1, raf = 0;

    /** Track the active section: tmux window highlight and the chrome hue. */
    const tick = () => {
      raf = 0;
      const y = scrollY + innerHeight * 0.4;
      let i = 0; tops.forEach((t, k) => { if (y >= t - 2) i = k; });
      if (i === active) return;
      active = i;
      wins.forEach((w, k) => (k === i ? w.setAttribute("aria-current", "true") : w.removeAttribute("aria-current")));
      html.dataset.glHue = SECTIONS[i][2];
    };
    /** Measure section tops for the active-window tracker. */
    const measure = () => { tops = secs.map((s) => s.getBoundingClientRect().top + scrollY); tick(); };
    // performance mode holds one still shader frame; re-draw it once scrolling stops so it matches the page
    let stillT: ReturnType<typeof setTimeout> | undefined;
    on(window, "scroll", () => {
      if (!raf) raf = requestAnimationFrame(tick);
      if (calm()) { clearTimeout(stillT); if (stillT) timers.delete(stillT); stillT = later(kick, 160); }
    }, { passive: true });
    const ro = new ResizeObserver(measure); ro.observe(root);

    /* ───── navigation ───── */
    const smooth = (): ScrollBehavior => (calm() ? "auto" : "smooth");
    const go = (i: number) => { i = Math.max(0, Math.min(secs.length - 1, i)); if (i === 0) scrollTo({ top: 0, behavior: smooth() }); else secs[i].scrollIntoView({ behavior: smooth(), block: "start" }); };
    const step = (dir: number) => {
      const ps = $$(".gl-pane, .gl-hero").map((s) => s.getBoundingClientRect().top + scrollY);
      if (dir > 0) { const n = ps.find((t) => t > scrollY + 60); scrollTo({ top: n !== undefined ? n - 40 : document.documentElement.scrollHeight, behavior: smooth() }); }
      else { const n = ps.filter((t) => t < scrollY - 60).pop(); scrollTo({ top: n !== undefined ? Math.max(0, n - 40) : 0, behavior: smooth() }); }
    };
    $$("[data-gl-go]").forEach((w) => on(w, "click", (ev) => { ev.preventDefault(); go(+w.dataset.glGo!); }));
    let msgT: ReturnType<typeof setTimeout> | undefined, qi = 0;
    const say = (t: string) => { msg.textContent = t; msg.classList.add("on"); clearTimeout(msgT); if (msgT) timers.delete(msgT); msgT = later(() => { msg.classList.remove("on"); msg.textContent = ""; }, 2200); };
    on(window, "keydown", (e) => {
      const ev = e as KeyboardEvent;
      if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
      if (html.classList.contains("locked") || document.getElementById("switcher")?.classList.contains("open")) return;
      const k = ev.key;
      if (k === "Escape") toggleKeys(false);
      else if (k === "j") step(1);
      else if (k === "k") step(-1);
      else if (k === "g") scrollTo({ top: 0, behavior: smooth() });
      else if (k === "G") scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth() });
      else if (/^[1-7]$/.test(k)) go(+k - 1);
      else if (k === ":") { ev.preventDefault(); site.current.openAgent(); }
      else if (k === "r") site.current.openResume();
      else if (k === "m") site.current.openComposer("");
      else if (k === "p") site.current.openPlay("records");
      else if (k === "?") { ev.preventDefault(); ev.stopPropagation(); toggleKeys(); } // before AgentDock's own global "?"
      else if (/^[a-z]$/i.test(k) && k !== "t" && k !== "T") say(QUIPS[qi++ % QUIPS.length]);
    }, { capture: true }); // capture: runs ahead of the agent's document-level "?" handler

    /* ───── the hero prompt types its own questions while the hero is on screen (never in performance mode) ───── */
    const askIn = $<HTMLInputElement>("#gl-ask-in");
    let heroOn = true, qn = 0, ci = ASKS[0].length, dir = -1, hold = 40;
    const typeT = setInterval(() => {
      if (calm() || !heroOn || document.activeElement === askIn || askIn.value) { if (calm()) askIn.placeholder = ASKS[0]; return; }
      if (hold > 0) { hold--; return; }
      const q = ASKS[qn]; ci += dir;
      if (ci <= 0) { dir = 1; qn = (qn + 1) % ASKS.length; ci = 0; hold = 4; }
      else if (ci >= ASKS[qn].length) { dir = -1; hold = 46; }
      askIn.placeholder = (dir > 0 ? ASKS[qn] : q).slice(0, Math.max(0, ci)) + "▌";
    }, 55);

    /* ───── decode: headings resolve out of scrambled glyphs once, on first view ───── */
    const jobs: { el: HTMLElement; T: string; t0: number; d: number }[] = []; let sRaf = 0;
    const run = (now: number) => {
      sRaf = 0;
      for (let j = jobs.length - 1; j >= 0; j--) {
        const { el, T, t0, d } = jobs[j], k = (now - t0) / d;
        if (k >= 1 || calm()) { el.textContent = T; jobs.splice(j, 1); continue; }
        let out = "";
        for (let i = 0; i < T.length; i++) { const c = T[i], at = (i / T.length) * 0.65 + (((i * 7919) % 13) / 13) * 0.3; out += c === " " || k > at ? c : GLY[(Math.random() * GLY.length) | 0]; }
        el.textContent = out;
      }
      if (jobs.length) sRaf = requestAnimationFrame(run);
    };
    const scramble = (el: HTMLElement) => {
      if (calm()) return;
      const T = el.dataset.scrT || el.textContent || ""; el.dataset.scrT = T;
      jobs.push({ el, T, t0: performance.now(), d: Math.min(1000, 360 + T.length * 22) });
      if (!sRaf) sRaf = requestAnimationFrame(run);
    };
    const io = new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { io.unobserve(x.target); scramble(x.target as HTMLElement); } }), { rootMargin: "0px 0px -8% 0px" });
    $$("[data-scr]").forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) scramble(el); else io.observe(el); });
    const heroIo = new IntersectionObserver((en) => { heroOn = en[0].isIntersecting; });
    heroIo.observe(secs[0]);

    // a still shader frame is drawn at load in reduced motion / performance mode; redraw once its boot has settled
    if (calm()) later(kick, 2900);

    measure();
    later(measure, 600);
    if (document.fonts?.ready) document.fonts.ready.then(() => { if (root.isConnected) measure(); });

    return () => {
      offs.forEach((f) => f()); timers.forEach((id) => clearTimeout(id)); timers.clear();
      clearInterval(typeT);
      cancelAnimationFrame(raf); cancelAnimationFrame(sRaf);
      ro.disconnect(); io.disconnect(); heroIo.disconnect();
      // a decode cut short must not leave scrambled text behind
      jobs.forEach(({ el, T }) => { el.textContent = T; });
      delete html.dataset.glHue;
    };
  }, [rootRef, toggleKeys]);
}
