/** Pure math for the Play field: an infinite plane made of one composed tile repeated forever. Each item is
 *  drawn `copies` times per axis and every copy wraps on its own, so a fixed pool of DOM nodes covers any pan. */

/** Positive modulo: wrap(-1, 10) = 9. */
export const wrap = (v: number, p: number) => ((v % p) + p) % p;

/** Copies per axis so the band [-pad, view + pad) always holds every copy that can be on screen (pad >= item size). */
export const copiesFor = (view: number, tile: number, pad: number) => Math.max(1, Math.ceil((view + 2 * pad) / tile));

/** Screen coordinate of copy `k` of an item at tile coordinate `x`, after panning by `off`. Copies sit one tile
 *  apart and wrap over `copies * tile`, so a copy leaving one edge re-enters at the other, out of sight. */
export const place = (x: number, off: number, k: number, tile: number, copies: number, pad: number) =>
  wrap(x + off + k * tile + pad, copies * tile) - pad;

/** True when a span [pos, pos + size) overlaps [0, view). */
export const onScreen = (pos: number, size: number, view: number) => pos + size > 0 && pos < view;

/** Velocity (px/ms) from recent [time, x, y] samples, reading only the last `win` ms so a pause before release
 *  throws nothing. */
export function velocity(samples: [number, number, number][], win = 80): [number, number] {
  const last = samples[samples.length - 1];
  if (!last) return [0, 0];
  const first = samples.find((s) => last[0] - s[0] <= win) ?? last;
  const dt = last[0] - first[0];
  return dt > 0 ? [(last[1] - first[1]) / dt, (last[2] - first[2]) / dt] : [0, 0];
}
