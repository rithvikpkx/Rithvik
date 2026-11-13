"use client";
import { useEffect, useRef } from "react";
import type { ShaderSpec } from "@/lib/designs/types";
import { mount, unmount, setDark, setUniform, isAnimating, type UniformValue } from "@/lib/shader/runtime";
import { createFpsAverager, createSlowDetector } from "@/lib/shader/helpers";
import { useSite } from "./SiteProvider";

/** Stable setter for the active design's own uniforms (persist per frame, cleared on design switch).
 *  Call it after the canvas is mounted, or pass the `uniforms` prop for initial values. */
export function useShaderUniforms(): (name: string, value: UniformValue) => boolean {
  return setUniform;
}

let offered = false; // the performance-mode offer is made once per page session

/** Watches real frame pacing while the shader animates; offers performance mode once when two
 *  consecutive 3s windows average under ~32fps. */
function useFpsWatchdog(armed: boolean) {
  const { lite, toast, setLite } = useSite();
  useEffect(() => {
    if (!armed || offered || lite) return;
    const avg = createFpsAverager(180), slow = createSlowDetector(32, 2);
    let raf = 0, prev = 0, timer: ReturnType<typeof setInterval> | undefined;
    const tick = (now: number) => { raf = requestAnimationFrame(tick); if (prev) avg.push(Math.min(now - prev, 250)); prev = now; };
    const reset = () => { prev = 0; avg.clear(); };
    const sample = () => {
      // windows only count while frames are really being produced and enough were seen
      const ok = isAnimating() && avg.size >= 30, fps = ok ? avg.fps : Infinity;
      avg.clear();
      if (slow.push(fps) && !offered) {
        offered = true;
        toast("This device is working hard. Switch to performance mode?", () => setLite(true), "Switch");
      }
    };
    const start = setTimeout(() => { raf = requestAnimationFrame(tick); timer = setInterval(sample, 3000); }, 3500);
    document.addEventListener("visibilitychange", reset);
    return () => { clearTimeout(start); clearInterval(timer); cancelAnimationFrame(raf); document.removeEventListener("visibilitychange", reset); };
  }, [armed, lite, toast, setLite]);
}

/** Hosts the page's single shader canvas: inside `spec.host` (found in the design's markup) or in a
 *  fixed full-screen layer. Renders nothing without a spec. `uniforms` are applied after each mount. */
export default function ShaderCanvas({ spec, dark, uniforms }: { spec: ShaderSpec | undefined; dark: boolean; uniforms?: Record<string, UniformValue> }) {
  const layer = useRef<HTMLDivElement>(null);
  const darkRef = useRef(dark);
  useFpsWatchdog(!!spec);

  useEffect(() => { darkRef.current = dark; setDark(dark); }, [dark]);

  useEffect(() => {
    if (!spec) return;
    let mo: MutationObserver | undefined;
    const go = (host: HTMLElement) => mount(host, spec, darkRef.current);
    const found = spec.host ? document.querySelector<HTMLElement>(spec.host) : layer.current;
    if (found) go(found);
    else if (spec.host) {
      // the design is lazy-loaded: wait for its host element to appear
      mo = new MutationObserver(() => {
        const h = document.querySelector<HTMLElement>(spec.host!);
        if (h) { mo?.disconnect(); mo = undefined; go(h); }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    return () => { mo?.disconnect(); unmount(); };
  }, [spec]);

  useEffect(() => {
    if (!spec) return;
    for (const [n, v] of Object.entries(uniforms ?? {})) setUniform(n, v);
  }, [spec, uniforms]);

  if (!spec || spec.host) return null;
  return <div ref={layer} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}
