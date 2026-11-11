/** Pure shader-runtime helpers: no DOM, no GL, unit-tested in shader.test.ts. */

/** "#rrggbb" (or "rrggbb") → [r,g,b] in 0..1; anything unparseable is black. */
export function hexToVec3(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex ?? "");
  return m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) as [number, number, number] : [0, 0, 0];
}

export const MIN_SCALE = 0.3; // never render below 30% of CSS size
const SLOW_MS = 22; // a frame longer than this counts as slow (~45fps)
const FAST_MS = 18; // a frame shorter than this counts toward recovery
const DROP_AFTER = 24; // net slow frames before dropping
const RECOVER_AFTER = 300; // consecutive fast frames (~5s) before creeping back up

/** Adaptive resolution: `push(dt)` per frame returns the current scale. Drops x0.8 when frames
 *  run long, climbs x1.1 after a long fast streak (up to 90% of the scale that hurt), within [MIN_SCALE, base]. */
export function createScaleController(base: number) {
  let scale = base, slow = 0, fast = 0, ceiling = base;
  return {
    get scale() { return scale; },
    /** Restart for a new design: new base, counters cleared. */
    reset(b: number) { scale = ceiling = b; slow = fast = 0; },
    push(dt: number) {
      slow = dt > SLOW_MS ? slow + 1 : Math.max(0, slow - 1);
      fast = dt < FAST_MS ? fast + 1 : 0;
      if (slow > DROP_AFTER && scale > MIN_SCALE) {
        ceiling = scale; // the scale that hurt: recovery stops just short of it, so it can't oscillate
        scale = Math.max(MIN_SCALE, scale * 0.8); slow = 0; fast = 0;
      } else if (fast >= RECOVER_AFTER && scale < Math.min(base, ceiling * 0.9)) {
        scale = Math.min(base, ceiling * 0.9, scale * 1.1); fast = 0;
      }
      return scale;
    },
  };
}

/** Rolling frame-time average over the last `n` frames; `fps` is 0 until the window has samples. */
export function createFpsAverager(n = 60) {
  const buf: number[] = [];
  return {
    push(dt: number) { buf.push(dt); if (buf.length > n) buf.shift(); },
    clear() { buf.length = 0; },
    get fps() { return buf.length ? (buf.length * 1000) / buf.reduce((a, b) => a + b, 0) : 0; },
    get size() { return buf.length; },
  };
}

/** Slow-window detector: feed one average fps per sampling window; true once `needed`
 *  consecutive windows fall under `threshold` (a fast window resets the streak). */
export function createSlowDetector(threshold = 32, needed = 2) {
  let streak = 0;
  return { push(fps: number) { streak = fps < threshold ? streak + 1 : 0; return streak >= needed; } };
}

/** `count` × vec4 of fixed randoms in [0,1) for a particle pass (mulberry32, so every load draws the same cloud). */
export function pointSeeds(count: number, seed = 1): Float32Array {
  const out = new Float32Array(count * 4);
  let a = seed >>> 0;
  for (let i = 0; i < out.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    out[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return out;
}

const REF_AREA = 1440 * 900; // the laptop viewport the full count is tuned for

/** How many of `count` points to draw: fewer on a small screen (sqrt of the area ratio, so a phone stays dense) and
 *  fewer again as the adaptive resolution drops (the square of `scale / base`), never under a quarter of the budget. */
export function pointBudget(count: number, cssArea: number, scale: number, base: number): number {
  const area = Math.min(1, Math.sqrt(Math.max(0, cssArea) / REF_AREA));
  const perf = Math.max(0.25, Math.min(1, (scale / base) ** 2));
  return Math.max(1, Math.round(count * Math.max(0.25, area) * perf));
}
