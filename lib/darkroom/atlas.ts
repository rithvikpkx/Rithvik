import type { Atlas } from "./frame.ts";

const cache = new Map<string, Atlas>();

/** Glyph coverage masks for `chars`, each fitted to a cw×ch cell. Uses an (Offscreen)Canvas when one exists (page or worker);
 *  otherwise (node tests) falls back to discs whose size follows the character's position in the ramp, which keeps tone mapping honest. */
export function makeAtlas(chars: string, cw: number, ch: number): Atlas {
  const key = `${chars}|${cw}|${ch}`, hit = cache.get(key);
  if (hit) return hit;
  const list = [...chars], n = list.length, mask = new Uint8Array(n * cw * ch);
  const ctx = typeof OffscreenCanvas !== "undefined" ? (new OffscreenCanvas(cw, ch).getContext("2d", { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null) : null;
  if (ctx) {
    const fs = ch * 0.82;
    ctx.font = `600 ${fs}px "Geist Mono", ui-monospace, Menlo, monospace`;
    const sx = cw / Math.max(1, ctx.measureText("M").width * 1.04); // squeeze or stretch so a glyph fills its cell width
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "center";
    list.forEach((c, i) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(sx, 0, 0, 1, cw / 2, 0);
      ctx.fillStyle = "#fff";
      ctx.fillText(c, 0, ch * 0.8);
      const d = ctx.getImageData(0, 0, cw, ch).data;
      for (let p = 0; p < cw * ch; p++) mask[i * cw * ch + p] = d[p * 4 + 3];
    });
  } else {
    list.forEach((_, i) => {
      const r = (i / Math.max(1, n - 1)) * 0.5 * Math.min(cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) mask[i * cw * ch + y * cw + x] = i ? Math.max(0, Math.min(1, r - Math.hypot(x + 0.5 - cw / 2, y + 0.5 - ch / 2) + 0.5)) * 255 : 0;
    });
  }
  const atlas = { cw, ch, n, mask };
  if (cache.size > 12) cache.clear();
  cache.set(key, atlas);
  return atlas;
}
