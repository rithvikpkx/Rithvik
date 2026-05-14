"use client";

import { useEffect, useRef, useState } from "react";
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

/** Project (lat,lng) → 3D unit-sphere screen coords in cobe v2's frame.
 *  Mirrors cobe's internal U() (location → 3D) and A() rotation matrix from
 *  the sphere shader so the overlay tracks the texture rather than landing
 *  180° away. Camera looks along +Z toward the origin, so the camera-facing
 *  hemisphere is `z > 0`. */
function project(
  lat: number,
  lng: number,
  phi: number,
  theta: number,
): { x: number; y: number; visible: boolean } {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const cosLat = Math.cos(latR);
  // Initial position on unit sphere in cobe's frame.
  const x0 = cosLat * Math.cos(lngR);
  const y0 = Math.sin(latR);
  const z0 = -cosLat * Math.sin(lngR);
  // Rotate around Y by phi.
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const x1 = cosP * x0 + sinP * z0;
  const z1 = -sinP * x0 + cosP * z0;
  // Rotate around X by theta (applied after phi, matching cobe).
  const cosT = Math.cos(theta), sinT = Math.sin(theta);
  const y2 = cosT * y0 - sinT * z1;
  const z2 = sinT * y0 + cosT * z1;
  return { x: x1, y: y2, visible: z2 > 0 };
}

const THETA = 0.3;

function formatLocalTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true,
    }).format(date);
  } catch {
    return "—";
  }
}

function formatTzShort(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
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
  _markers: GlobeMarker[],
  palette: ReturnType<typeof readPalette>,
  size: number,
): COBEOptions {
  // Markers are rendered via the DOM overlay layer (kind-aware colors, hover
  // tooltips, keyboard focus), not by cobe — cobe can only paint one global
  // markerColor and ignores per-marker color metadata. Passing an empty list
  // here removes the redundant accent-only canvas dots that would otherwise
  // sit underneath every DOM marker.
  // Cobe shades the sphere as `baseColor * mix((1-q)*pow(i,.4), q, dark) + glowColor * fresnel`.
  // So `baseColor` is the bright pole of the gradient: in dark mode it tints the wireframe
  // dots; in light mode it tints the ocean. Using `palette.text` for both modes paints the
  // sphere with the foreground color, which in light mode is near-black and crushes the
  // continents into a featureless dark blob (no contrast on a white card). Swap so light
  // mode gets bright `bg` as the sphere body and dark `text` as the silhouette glow,
  // mirroring dark mode's "bright material / dark edge" recipe.
  const baseColor = palette.dark ? palette.text : palette.bg;
  const glowColor = palette.dark ? palette.bg : palette.text;

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
    baseColor,
    markerColor: palette.accent,
    glowColor,
    markers: [],
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
  const tooltipRef = useRef<HTMLDivElement>(null);
  const widthRef = useRef(0);
  const pointerInteracting = useRef<number | null>(null);
  const hoverIdxRef = useRef<number | null>(null);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Mirror hoverIdx to a ref so the rAF tick can read it without re-running.
  useEffect(() => { hoverIdxRef.current = hoverIdx; }, [hoverIdx]);

  // Tick `now` every 30s only while a tooltip is open, so the displayed time stays fresh.
  useEffect(() => {
    if (hoverIdx === null) return;
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, [hoverIdx]);

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
      // Idle: ease the drag spring toward 0 so the globe drifts back to the
      // US-centered rest pose (phi = 0). ~0.96 per frame at 60fps = ~3s settle
      // time, which reads as "gentle" without feeling sluggish.
      if (pointerInteracting.current === null) {
        const cur = r.get();
        if (Math.abs(cur) > 0.0005) r.set(cur * 0.96);
        else if (cur !== 0) r.set(0);
      }
      const phi = rs.get();
      globeRef.current.update({
        phi,
        width: widthRef.current * 2,
        height: widthRef.current * 2,
      });

      // Drive the DOM overlay in lockstep with the canvas frame.
      const w = widthRef.current;
      const cx = w / 2;
      const cy = w / 2;
      const radius = w * 0.425; // cobe sphere radius 0.8 + marker elevation 0.05, in CSS px
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

      // Drag the tooltip alongside its marker so it tracks rotation in real time.
      const hover = hoverIdxRef.current;
      const tooltip = tooltipRef.current;
      if (hover !== null && tooltip && markers[hover]) {
        const p = project(markers[hover].lat, markers[hover].lng, phi, THETA);
        const sx = cx + p.x * radius;
        const sy = cy - p.y * radius;
        tooltip.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, calc(-100% - 14px))`;
        tooltip.style.opacity = p.visible ? "1" : "0";
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
  }, [markers, r, rs]);

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
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx((cur) => (cur === i ? null : cur))}
            onFocus={() => setHoverIdx(i)}
            onBlur={() => setHoverIdx((cur) => (cur === i ? null : cur))}
          />
        ))}
        {hoverIdx !== null && markers[hoverIdx] && (
          <div ref={tooltipRef} className="globe-tooltip" role="tooltip">
            <strong>
              {markers[hoverIdx].city}
              {markers[hoverIdx].region ? `, ${markers[hoverIdx].region}` : ""}
            </strong>
            <span className="globe-tooltip-country">{markers[hoverIdx].country}</span>
            <span className="globe-tooltip-time">
              {formatLocalTime(now, markers[hoverIdx].timezone)}{" "}
              <span className="globe-tooltip-tz">{formatTzShort(now, markers[hoverIdx].timezone)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
