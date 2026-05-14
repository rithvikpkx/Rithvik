"use client";

import { useEffect, useRef } from "react";
import createGlobe, { type COBEOptions, type Globe as CobeGlobe } from "cobe";
import { useMotionValue, useSpring } from "motion/react";
import type { GlobeMarker } from "@/lib/types";

const MOVEMENT_DAMPING = 1400;

type RGB = [number, number, number];

/** Parses any CSS color string (hex, rgb, oklch, var-resolved value) into a
 *  [r,g,b] triple in [0,1]. Uses an offscreen 1x1 canvas to let the browser
 *  do the normalization — pure CSS-color parsing in JS is hard.
 *  Falls back to medium gray on any failure. */
function parseColor(css: string): RGB {
  if (typeof document === "undefined") return [0.5, 0.5, 0.5];
  const cnv = document.createElement("canvas");
  cnv.width = 1; cnv.height = 1;
  const ctx = cnv.getContext("2d");
  if (!ctx) return [0.5, 0.5, 0.5];
  ctx.fillStyle = "#888";       // reset baseline so an invalid input doesn't carry over
  ctx.fillStyle = css.trim();   // browser parses; if invalid, fillStyle keeps the prior value
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/** sRGB relative luminance per WCAG. Used to pick cobe's `dark: 0|1`. */
function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function readPalette() {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const bg = parseColor(css.getPropertyValue("--bg"));
  const text = parseColor(css.getPropertyValue("--text"));
  const accent = parseColor(css.getPropertyValue("--accent"));
  const dark = luminance(bg) < 0.5 ? 1 : 0;
  return { bg, text, accent, dark };
}

function buildConfig(
  markers: GlobeMarker[],
  palette: ReturnType<typeof readPalette>,
  size: number,
): COBEOptions {
  const cobeMarkers = markers.map((m) => {
    // Size by kind. Color cannot be per-marker through the global markerColor,
    // so we set markerColor to accent here and (Task 9+) rely on the DOM
    // overlay layer for kind-specific visual differentiation. Size still
    // encodes kind so home/current dots read larger on the canvas itself.
    const dotSize = m.kind === "current" ? 0.12 : m.kind === "home" ? 0.10 : 0.06;
    return { location: [m.lat, m.lng] as [number, number], size: dotSize };
  });

  return {
    width: size,
    height: size,
    devicePixelRatio: 2,
    phi: 0,
    theta: 0.3,
    dark: palette.dark,
    diffuse: 1.0,
    mapSamples: 16000,
    mapBrightness: palette.dark ? 4 : 1.2,
    baseColor: palette.text,
    markerColor: palette.accent,
    glowColor: palette.bg,
    markers: cobeMarkers,
  };
}

export interface GlobeProps {
  markers: GlobeMarker[];
  className?: string;
}

export function Globe({ markers, className }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const widthRef = useRef(0);
  const phiRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);

  const r = useMotionValue(0);
  const rs = useSpring(r, { mass: 1, damping: 30, stiffness: 100 });

  const updatePointer = (val: number | null) => {
    pointerInteracting.current = val;
    if (canvasRef.current) canvasRef.current.style.cursor = val !== null ? "grabbing" : "grab";
  };
  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current;
      r.set(r.get() + delta / MOVEMENT_DAMPING);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onResize = () => { widthRef.current = canvas.offsetWidth; };
    window.addEventListener("resize", onResize);
    onResize();

    // Cobe v2 has no onRender callback; drive rotation by calling update()
    // from a requestAnimationFrame loop. We keep a ref to the current globe
    // so the loop and theme-swap rebuild can swap instances without restarting.
    const buildAndStart = (): CobeGlobe => {
      const palette = readPalette();
      const config = buildConfig(markers, palette, widthRef.current * 2);
      return createGlobe(canvas, config);
    };
    const globeRef: { current: CobeGlobe } = { current: buildAndStart() };

    let raf = 0;
    const tick = () => {
      if (pointerInteracting.current === null) phiRef.current += 0.005;
      globeRef.current.update({
        phi: phiRef.current + rs.get(),
        width: widthRef.current * 2,
        height: widthRef.current * 2,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    setTimeout(() => { canvas.style.opacity = "1"; }, 0);

    const themeObserver = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.attributeName === "data-theme") {
          globeRef.current.destroy();
          globeRef.current = buildAndStart();
          return;
        }
      }
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      cancelAnimationFrame(raf);
      themeObserver.disconnect();
      globeRef.current.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, [markers, rs]);

  return (
    <div className={`globe-wrap${className ? " " + className : ""}`}>
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        onPointerDown={(e) => {
          pointerInteracting.current = e.clientX;
          updatePointer(e.clientX);
        }}
        onPointerUp={() => updatePointer(null)}
        onPointerOut={() => updatePointer(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => { if (e.touches[0]) updateMovement(e.touches[0].clientX); }}
      />
    </div>
  );
}
