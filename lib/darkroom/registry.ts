import { CAMERA } from "./fx-camera.ts";
import { GLITCH } from "./fx-glitch.ts";
import { LINE } from "./fx-line.ts";
import { PIXEL } from "./fx-pixel.ts";
import { PRINT } from "./fx-print.ts";
import { type Effect, type Family, type Step } from "./types.ts";

export const EFFECTS: Effect[] = [...PRINT, ...PIXEL, ...LINE, ...GLITCH, ...CAMERA];
export const BY_ID = new Map(EFFECTS.map((e) => [e.id, e]));
export const FAMILIES: { id: Family; name: string }[] = [
  { id: "print", name: "Print" }, { id: "pixel", name: "Pixel" }, { id: "line", name: "Line" }, { id: "glitch", name: "Glitch" }, { id: "camera", name: "Camera" },
];

/** An effect's default parameter values. */
export const defaults = (e: Effect): Record<string, number> => Object.fromEntries(e.params.map((p) => [p.key, p.def]));

/** A fresh stack step for an effect at full intensity with default parameters. */
export const stepFor = (id: string): Step => ({ id, intensity: 1, params: defaults(BY_ID.get(id)!) });

/** Parameters for `e` with every key present and clamped to its range (unknown keys dropped, missing ones defaulted). */
export function fill(e: Effect, given: Record<string, number>): Record<string, number> {
  return Object.fromEntries(e.params.map((p) => { const v = given[p.key]; return [p.key, Number.isFinite(v) ? Math.min(p.max, Math.max(p.min, v)) : p.def]; }));
}

/** Random-but-pleasant parameters: every slider drawn inside its middle 70% (extremes rarely look good), snapped to its step. `rnd` returns 0..1. */
export function randomParams(e: Effect, rnd: () => number): Record<string, number> {
  return Object.fromEntries(e.params.map((p) => {
    if (p.options) return [p.key, Math.round(p.min + rnd() * (p.max - p.min))];
    const v = p.min + (0.15 + rnd() * 0.7) * (p.max - p.min), snapped = Math.round(v / p.step) * p.step;
    return [p.key, +Math.min(p.max, Math.max(p.min, snapped)).toFixed(4)];
  }));
}
