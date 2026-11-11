"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
const RIPPLE = 2.6; // seconds a ripple lives

/** Lumen's one effect, on the hero: the pointer's light (`u_hover`) eases in while a fine pointer is over it and out
 *  when it leaves, and a press anywhere in the hero sends a ripple through the mesh (`u_tap`, its age advanced here).
 *  One rAF, running only while something is still changing; everything is undone on unmount. */
export function useLumenMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const hero = root.current?.querySelector<HTMLElement>("#top"), host = root.current?.querySelector<HTMLElement>("#lm-light");
    if (!hero || !host) return;
    let hover = 0, target = 0, tap: [number, number, number] | null = null, raf = 0, last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      hover += (target - hover) * (1 - Math.exp(-dt * 4));
      if (Math.abs(target - hover) < 0.003) hover = target;
      setUniform("u_hover", hover);
      if (tap) {
        tap[2] += dt;
        setUniform("u_tap", [tap[0], tap[1], tap[2], tap[2] < RIPPLE ? 1 : 0]);
        if (tap[2] >= RIPPLE) tap = null;
      }
      raf = hover === target && !tap ? 0 : requestAnimationFrame(tick);
      if (!raf) last = 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const enter = (e: PointerEvent) => { if (e.pointerType !== "touch" && !calm()) { target = 1; kick(); } };
    const leave = () => { target = 0; kick(); };
    const press = (e: PointerEvent) => {
      if (calm()) return;
      const r = host.getBoundingClientRect();
      tap = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, 0];
      kick();
    };
    hero.addEventListener("pointerenter", enter);
    hero.addEventListener("pointerleave", leave);
    hero.addEventListener("pointerdown", press);
    return () => {
      cancelAnimationFrame(raf);
      hero.removeEventListener("pointerenter", enter); hero.removeEventListener("pointerleave", leave); hero.removeEventListener("pointerdown", press);
    };
  }, [root, setUniform]);
}
