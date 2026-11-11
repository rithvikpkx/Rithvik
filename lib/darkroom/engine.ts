import type { Atlas, Frame } from "./frame.ts";
import { BY_ID, fill } from "./registry.ts";
import type { Step } from "./types.ts";

/** Runs a stack of effects over a source frame. Pure and DOM-free, so the page, a worker and the tests all share it. */

/** Most recent results, keyed by the exact stack prefix that produced them. */
export class Cache {
  private m = new Map<string, Frame>();
  private max: number;
  constructor(max = 40) { this.max = max; }
  get(k: string) { const v = this.m.get(k); if (v) { this.m.delete(k); this.m.set(k, v); } return v; }
  set(k: string, v: Frame) { this.m.set(k, v); while (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string); }
  clear() { this.m.clear(); }
  get size() { return this.m.size; }
}

/** Linear mix of two same-size frames: `a` at 0, `b` at 1. */
export function mix(a: Frame, b: Frame, t: number): Frame {
  const out = new Uint8ClampedArray(a.data.length);
  for (let i = 0; i < out.length; i++) out[i] = a.data[i] + (b.data[i] - a.data[i]) * t;
  return { w: a.w, h: a.h, data: out };
}

/** Applies `steps` in order over `src`. Each step's raw output is cached by (everything below it, its id, its params) and its mixed result by that plus its intensity, so changing the top slider or adding one effect recomputes only the top. Animated steps fold `t` into the key. */
export function runStack(src: Frame, steps: Step[], o: { t: number; atlas: (c: string, cw: number, ch: number) => Atlas; cache?: Cache; srcKey?: string }): Frame {
  let cur = src, key = o.srcKey ?? "src";
  const env = { k: src.w / 512, t: o.t, atlas: o.atlas };
  for (const s of steps) {
    const fx = BY_ID.get(s.id);
    if (!fx) continue;
    const p = fill(fx, s.params), pk = `${s.id}:${fx.params.map((q) => p[q.key]).join(",")}${fx.animated ? `@${o.t.toFixed(3)}` : ""}`;
    const live = !key.includes("@") && !fx.animated; // anything downstream of an animated step is never seen twice
    const rawKey = `r|${key}|${pk}`, outKey = `o|${key}|${pk}|${s.intensity.toFixed(3)}`, hit = o.cache?.get(outKey);
    key = `${key}>${pk}|${s.intensity.toFixed(3)}`;
    if (hit) { cur = hit; continue; }
    const raw = o.cache?.get(rawKey) ?? fx.apply(cur, p, env);
    if (o.cache && live) o.cache.set(rawKey, raw);
    const out = s.intensity >= 0.999 ? raw : mix(cur, raw, Math.max(0, s.intensity));
    if (o.cache && live) o.cache.set(outKey, out);
    cur = out;
  }
  return cur;
}
