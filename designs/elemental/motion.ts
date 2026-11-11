"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";
import { IDLE_AGE, STRIKE_S, chargeStep, toCanvas } from "./core";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
export const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

// a press on these is the visitor using the page, not throwing a strike
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role=button], .pt, .agent, .kn";

/** The family's one motion hook. The fixed shader host shows only while the hero or Contact is on screen (between
 *  them it is hidden, so the runtime pauses); the pointer's speed gathers a charge (`u_charge` + `--el-charge`)
 *  that the world answers with more energy; a press on open ground throws a strike, a shockwave in the shader
 *  (`u_burst`) and a jolt in the copy (`data-strike`); section sigils draw themselves in as they arrive.
 *  Everything it adds is removed on unmount (design switch). */
export function useElementalMotion(root: RefObject<HTMLElement | null>, host: string) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const gl = el.querySelector<HTMLElement>(host);
    const offs: (() => void)[] = [];
    let glOk = true; // no WebGL (or a lost shader): stop asking, so the console stays quiet
    const set = (n: string, v: number | [number, number, number]) => { if (glOk) glOk = setUniform(n, v); };
    const on = (t: EventTarget | null, ev: string, fn: EventListener, o?: AddEventListenerOptions) => { if (!t) return; t.addEventListener(ev, fn, o); offs.push(() => t.removeEventListener(ev, fn, o)); };

    // the world is on screen only around the hero and Contact
    const seen = new Set<string>();
    const gio = new IntersectionObserver((en) => {
      en.forEach((e) => (e.isIntersecting ? seen.add(e.target.id) : seen.delete(e.target.id)));
      if (gl) gl.style.display = seen.size ? "" : "none";
      el.toggleAttribute("data-el-contact", seen.has("contact") && !seen.has("top"));
    }, { threshold: 0 });
    el.querySelectorAll("#top, #contact").forEach((s) => gio.observe(s));

    // sigils draw in once, the first time their section arrives
    const sio = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).dataset.in = ""; sio.unobserve(e.target); } }), { rootMargin: "0px 0px -15% 0px" });
    el.querySelectorAll(".el-orn").forEach((o) => (calm() ? ((o as HTMLElement).dataset.in = "") : sio.observe(o)));

    // charge: pointer speed, smoothed; the loop runs only while there is charge to show
    let charge = 0, speed = 0, lx = 0, ly = 0, lt = 0, raf = 0, prev = 0;
    const tick = (now: number) => {
      raf = 0;
      const dt = prev ? (now - prev) / 1000 : 1 / 60; prev = now;
      if (now - lt > 80) speed *= 0.8; // the pointer has stopped: its speed fades
      charge = chargeStep(charge, speed, dt);
      set("u_charge", charge);
      el.style.setProperty("--el-charge", charge.toFixed(3));
      if (charge > 0 || speed > 0.01) raf = requestAnimationFrame(tick);
      else prev = 0;
    };
    on(window, "pointermove", (e) => {
      const ev = e as PointerEvent;
      if (calm() || !seen.size) return;
      const dt = Math.max(8, ev.timeStamp - lt);
      if (lt) speed = speed * 0.7 + (Math.hypot(ev.clientX - lx, ev.clientY - ly) / dt) * 0.3;
      lx = ev.clientX; ly = ev.clientY; lt = ev.timeStamp;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    // strike: a shockwave from where the visitor pressed, its age clocked here so the shader stays stateless
    let sraf = 0, t0 = 0, jolt: ReturnType<typeof setTimeout> | undefined;
    const age = (now: number) => {
      const a = (now - t0) / 1000;
      if (a >= STRIKE_S) { set("u_burst", [0.5, 0.5, IDLE_AGE]); sraf = 0; return; }
      set("u_burst", [bx, by, a]);
      sraf = requestAnimationFrame(age);
    };
    let bx = 0.5, by = 0.5;
    const strike = (e: Event) => {
      const ev = e as PointerEvent, t = ev.target as Element | null;
      if (calm() || !gl || ev.button > 0 || t?.closest?.(INTERACTIVE)) return;
      [bx, by] = toCanvas(ev.clientX, ev.clientY, gl.getBoundingClientRect());
      t0 = performance.now();
      el.style.setProperty("--el-sx", `${ev.clientX}px`); el.style.setProperty("--el-sy", `${ev.clientY}px`);
      el.removeAttribute("data-strike"); void el.offsetWidth; el.setAttribute("data-strike", ""); // restart the jolt
      clearTimeout(jolt); jolt = setTimeout(() => el.removeAttribute("data-strike"), 700);
      cancelAnimationFrame(sraf); sraf = requestAnimationFrame(age);
    };
    el.querySelectorAll("#top, #contact").forEach((s) => on(s, "pointerdown", strike));

    return () => {
      offs.forEach((f) => f()); gio.disconnect(); sio.disconnect();
      cancelAnimationFrame(raf); cancelAnimationFrame(sraf); clearTimeout(jolt);
      if (gl) gl.style.display = "";
      el.removeAttribute("data-strike"); el.removeAttribute("data-el-contact"); el.style.removeProperty("--el-charge");
    };
  }, [root, host, setUniform]);
}
