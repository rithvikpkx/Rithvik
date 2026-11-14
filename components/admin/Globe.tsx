"use client";
import { useEffect, useRef, useState } from "react";
import type { GeoPoint } from "@/lib/analytics/types";

/** Any CSS colour (incl. oklch / color-mix) -> [0..1] RGB, via a 1x1 canvas. */
function rgb(css: string): [number, number, number] {
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const x = c.getContext("2d");
  if (!x) return [0.5, 0.5, 0.5];
  x.fillStyle = css;
  x.fillRect(0, 0, 1, 1);
  const [r, g, b] = x.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** A cobe globe of visitor locations: one marker per point, sized by sqrt(count) so a big city doesn't swallow the map.
 *  Colours come from the look's tokens. Drag to rotate; it drifts slowly otherwise, pauses off-screen and in hidden
 *  tabs, and holds still under reduced motion. cobe is loaded lazily so the dashboard paints first. */
export default function Globe({ points, label, focus }: { points: GeoPoint[]; label: string; focus?: { lat: number; lng: number } }) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = canvas.current, box = host.current;
    if (!el || !box) return;
    let globe: { update: (s: Record<string, unknown>) => void; destroy: () => void } | null = null;
    let raf = 0, visible = true, dead = false;
    // `focus`: start facing that spot (cobe's longitude/latitude to rotation) and hold still there instead of drifting
    let phi = focus ? Math.PI - ((focus.lng * Math.PI) / 180 - Math.PI / 2) : 4.2;
    let theta = focus ? Math.max(-0.6, Math.min(0.9, (focus.lat * Math.PI) / 180 * 0.85)) : 0.32;
    let vel = 0, drag: { x: number; y: number; phi: number; theta: number } | null = null;
    const still = !!focus || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const max = Math.max(1, ...points.map((p) => p.value));

    import("cobe").then(({ default: createGlobe }) => {
      if (dead) return;
      const cs = getComputedStyle(box);
      const bg = rgb(cs.getPropertyValue("--ui-bg") || "#fff");
      const dark = 0.299 * bg[0] + 0.587 * bg[1] + 0.114 * bg[2] < 0.5;
      const accent = rgb(cs.getPropertyValue("--ui-accent") || "#2a78d6");
      const w = box.clientWidth;
      const dpr = Math.min(2, devicePixelRatio || 1);
      globe = createGlobe(el, {
        devicePixelRatio: dpr, width: w * dpr, height: w * dpr, phi, theta, dark: dark ? 1 : 0, diffuse: dark ? 1.4 : 1.2,
        mapSamples: 16000, mapBrightness: dark ? 5 : 8, mapBaseBrightness: dark ? 0 : 0.05,
        baseColor: dark ? [0.32, 0.32, 0.34] : [1, 1, 1], markerColor: accent,
        glowColor: dark ? [0.12, 0.12, 0.14] : [0.92, 0.93, 0.95], opacity: dark ? 0.9 : 1, markerElevation: 0.01,
        markers: points.slice(0, 160).map((p) => ({ location: [p.lat, p.lng] as [number, number], size: 0.025 + 0.075 * Math.sqrt(p.value / max) })),
      });
      setOn(true);
      const loop = () => {
        raf = 0;
        if (!visible || dead || !globe) return;
        if (!drag && !still) phi += 0.0022 + vel;
        vel *= 0.94;
        globe.update({ phi, theta, width: box.clientWidth * dpr, height: box.clientWidth * dpr });
        if (!still || drag || Math.abs(vel) > 0.0001) raf = requestAnimationFrame(loop);
      };
      loop();
      const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && document.visibilityState === "visible"; if (visible) kick(); });
      io.observe(box);
      const vis = () => { visible = document.visibilityState === "visible"; if (visible) kick(); };
      document.addEventListener("visibilitychange", vis);
      const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, phi, theta }; el.setPointerCapture(e.pointerId); kick(); };
      const move = (e: PointerEvent) => {
        if (!drag) return;
        const nphi = drag.phi + (e.clientX - drag.x) / 160;
        vel = (nphi - phi) * 0.15;
        phi = nphi;
        theta = Math.max(-0.6, Math.min(0.9, drag.theta + (e.clientY - drag.y) / 300));
      };
      const up = () => { drag = null; };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      cleanup = () => { io.disconnect(); document.removeEventListener("visibilitychange", vis); el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up); };
    }).catch(() => {});
    let cleanup = () => {};
    return () => { dead = true; cancelAnimationFrame(raf); cleanup(); globe?.destroy(); };
  }, [points, focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- the focus object is recreated per render

  return (
    <div className="adm-globe" ref={host}>
      <canvas ref={canvas} className={on ? "on" : undefined} role="img" aria-label={label} />
      <span className="adm-globe-tip" aria-hidden="true">Drag to rotate</span>
    </div>
  );
}
