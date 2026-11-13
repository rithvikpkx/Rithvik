"use client";
import { useEffect, type RefObject } from "react";
import { useShaderUniforms } from "@/components/site/ShaderCanvas";

/** Calm = reduced motion or performance mode (`html.lite`); read live so toggling takes effect at once. */
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");

/** Clay's one effect: while a fine pointer is over the hero the shader's wet drop (`u_wet`) eases in under it, and
 *  dries off when it leaves. The rAF runs only while the value is still moving; everything is undone on unmount. */
export function useClayMotion(root: RefObject<HTMLElement | null>) {
  const setUniform = useShaderUniforms();
  useEffect(() => {
    const hero = root.current?.querySelector<HTMLElement>("#top");
    if (!hero || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let wet = 0, target = 0, raf = 0, last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      wet += (target - wet) * (1 - Math.exp(-dt * (target > wet ? 3 : 1.4))); // paint soaks in faster than it dries
      if (Math.abs(target - wet) < 0.003) wet = target;
      setUniform("u_wet", wet);
      raf = wet === target ? 0 : requestAnimationFrame(tick);
      if (!raf) last = 0;
    };
    const go = (to: number) => { target = calm() ? 0 : to; if (!raf) raf = requestAnimationFrame(tick); };
    const enter = (e: PointerEvent) => { if (e.pointerType !== "touch") go(1); };
    const leave = () => go(0);
    hero.addEventListener("pointerenter", enter);
    hero.addEventListener("pointerleave", leave);
    return () => { cancelAnimationFrame(raf); hero.removeEventListener("pointerenter", enter); hero.removeEventListener("pointerleave", leave); };
  }, [root, setUniform]);
}
