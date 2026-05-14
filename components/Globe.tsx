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

/** Project (lat,lng) → 3D unit sphere coords in cobe's convention, rotated
 *  by the current phi (around Y) and the fixed theta (around X). Returns
 *  screen-relative (x,y) in [-1, 1] and a visibility flag (true if the point
 *  is on the front-facing hemisphere). */
function project(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
): { x: number; y: number; visible: boolean } {
  const phiS = ((90 - lat) * Math.PI) / 180;
  const thetaS = ((lng + 180) * Math.PI) / 180;
  let x = Math.sin(phiS) * Math.cos(thetaS);
  let y = Math.cos(phiS);
  let z = Math.sin(phiS) * Math.sin(thetaS);
  // Rotate around Y by phi (spinning axis).
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const xR = x * cosP - z * sinP;
  const zR = x * sinP + z * cosP;
  x = xR; z = zR;
  // Rotate around X by theta (cobe's static tilt).
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const yR = y * cosT - z * sinT;
  const zR2 = y * sinT + z * cosT;
  y = yR; z = zR2;
  return { x, y, visible: z < 0 };
}

const THETA = 0.3;

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
      const phi = phiRef.current + rs.get();
      globeRef.current.update({
        phi,
        width: widthRef.current * 2,
        height: widthRef.current * 2,
      });

      // Drive the DOM overlay in lockstep with the canvas frame.
      const w = widthRef.current;
      const cx = w / 2;
      const cy = w / 2;
      const radius = w * 0.42; // tuned to cobe's drawn globe radius
      for (let i = 0; i < markers.length; i++) {
        const btn = buttonRefs.current[i];
        if (!btn) continue;
        const p = project(markers[i].lat, markers[i].lng, phi, THETA);
        const screenX = cx + p.x * radius;
        const screenY = cy - p.y * radius;
        btn.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%)`;
        btn.style.opacity = p.visible ? "1" : "0";
        btn.style.pointerEvents = p.visible ? "auto" : "none";
      }

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
      <div ref={overlayRef} className="globe-overlay" aria-label="Globe markers">
        {markers.map((m, i) => (
          <button
            key={m.id}
            ref={(el) => { buttonRefs.current[i] = el; }}
            type="button"
            className={`globe-marker globe-marker-${m.kind}`}
            aria-label={`${m.city}${m.region ? ", " + m.region : ""}, ${m.country}`}
          />
        ))}
      </div>
    </div>
  );
}
