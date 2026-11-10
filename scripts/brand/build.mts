// Builds the brand asset library in public/brand/ from the mark geometry (components/site/mark/ouro.ts) and the outlined
// Geist wordmark (scripts/brand/wordmark.ts), then copies the favicon/app icon/OG files into app/. Every raster is
// rendered from these vectors with sharp. Run: npm run brand
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { CHAIN, SMALL, ouroPath } from "../../components/site/mark/ouro.ts";
import { CAP, WORDS } from "./wordmark.ts";

const OUT = "public/brand";
const C = { ink: "#16161a", paper: "#fafaf9", night: "#0f0f12", snow: "#f4f4f5", accent: "#ff4d8d", mutedL: "#5c5c66", mutedD: "#a1a1aa" };
const M = ouroPath(), S = ouroPath(SMALL), K = ouroPath(CHAIN);

/** Ink bounding box of a path's absolute coordinates (all our paths are M/L polygons or font outlines at absolute coords). */
function bbox(d: string) {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number), xs = n.filter((_, i) => i % 2 === 0), ys = n.filter((_, i) => i % 2 === 1);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
const MB = bbox(M.d), SB = bbox(S.d);
const mc = (b: typeof MB) => [-(b.x0 + b.x1) / 2, -(b.y0 + b.y1) / 2]; // offset that centres the ink
const svg = (vb: string, body: string, size?: [number, number]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${size ? ` width="${size[0]}" height="${size[1]}"` : ""}>${body}</svg>\n`;
/** Ink that follows the viewer's colour scheme (favicon + animated files, which are shown as <img> where currentColor is black). */
const schemeInk = (sel: string) => `<style>${sel}{fill:${C.ink}}@media (prefers-color-scheme:dark){${sel}{fill:${C.snow}}}</style>`;
const files: Record<string, string> = {};

// ---- marks: centred on the ring, so a rotation in CSS turns it about its own centre
const markVB = "-50 -50 100 100";
files["mark.svg"] = svg(markVB, `<path d="${M.d}" fill="currentColor"/>`);
for (const [k, fill] of [["light", C.ink], ["dark", C.snow], ["black", "#000"], ["white", "#fff"], ["accent", C.accent]]) files[`mark-${k}.svg`] = svg(markVB, `<path d="${M.d}" fill="${fill}"/>`);
files["mark-small.svg"] = svg(markVB, `<path d="${S.d}" fill="currentColor"/>`);
files["favicon.svg"] = svg(markVB, schemeInk("path") + `<path d="${S.d}"/>`);

// ---- lockups: mark + wordmark. Horizontal: caps centred on the ring at 37% of its height. Stacked: two centred lines under it.
function lockup(stacked: boolean, ink: string) {
  const ring = MB.y1 - MB.y0, pad = 6;
  if (!stacked) {
    const fs = 0.44, gap = 22, x = MB.x1 + gap, base = (CAP * fs) / 2 + mc(MB)[1] * -1;
    const w = x + WORDS.name.w * fs;
    return svg(`${(MB.x0 - pad).toFixed(1)} ${(MB.y0 - pad).toFixed(1)} ${(w - MB.x0 + 2 * pad).toFixed(1)} ${(ring + 2 * pad).toFixed(1)}`,
      `<g fill="${ink}"><path d="${M.d}"/><path transform="translate(${x.toFixed(2)} ${base.toFixed(2)}) scale(${fs})" d="${WORDS.name.d}"/></g>`);
  }
  const fs = 0.24, lh = 0.24 * 128, [ox] = mc(MB), y1 = MB.y1 + 14 + CAP * fs, y2 = y1 + lh, wide = Math.max(WORDS.last.w * fs, ring);
  const line = (k: "first" | "last", y: number) => `<path transform="translate(${(-ox - (WORDS[k].w * fs) / 2).toFixed(2)} ${y.toFixed(2)}) scale(${fs})" d="${WORDS[k].d}"/>`;
  const cx = -ox, x0 = cx - wide / 2 - pad, y0 = MB.y0 - pad;
  return svg(`${x0.toFixed(1)} ${y0.toFixed(1)} ${(wide + 2 * pad).toFixed(1)} ${(y2 + 9 - y0).toFixed(1)}`, `<g fill="${ink}"><path d="${M.d}"/>${line("first", y1)}${line("last", y2)}</g>`);
}
for (const [k, ink] of [["light", C.ink], ["dark", C.snow]]) {
  files[`lockup-horizontal-${k}.svg`] = lockup(false, ink);
  files[`lockup-stacked-${k}.svg`] = lockup(true, ink);
}

// ---- app icons: the mark centred on a tile. `inset` = ring diameter as a share of the canvas.
function tile(px: number, bg: string, ink: string, inset: number, radius = 0, small = false) {
  const g = small ? S : M, b = small ? SB : MB, [ox, oy] = mc(b), k = (px * inset) / (b.x1 - b.x0);
  const r = radius ? `<rect width="${px}" height="${px}" rx="${px * radius}" fill="${bg}"/>` : bg === "none" ? "" : `<rect width="${px}" height="${px}" fill="${bg}"/>`;
  return svg(`0 0 ${px} ${px}`, `${r}<path transform="translate(${px / 2} ${px / 2}) scale(${k.toFixed(4)}) translate(${ox.toFixed(2)} ${oy.toFixed(2)})" d="${g.d}" fill="${ink}"/>`, [px, px]);
}

// ---- OG cards 1200x630: mark left, name in two lines, one line of context, the domain.
function og(dark: boolean) {
  const bg = dark ? C.night : C.paper, ink = dark ? C.snow : C.ink, muted = dark ? C.mutedD : C.mutedL;
  const k = 340 / (MB.x1 - MB.x0), [ox, oy] = mc(MB), mx = 96 + 170, my = 315;
  const t = (w: keyof typeof WORDS, x: number, y: number, s: number, fill: string) => `<path transform="translate(${x} ${y}) scale(${s})" d="${WORDS[w].d}" fill="${fill}"/>`;
  return svg("0 0 1200 630", `<rect width="1200" height="630" fill="${bg}"/>` +
    `<path transform="translate(${mx} ${my}) scale(${k.toFixed(4)}) translate(${ox.toFixed(2)} ${oy.toFixed(2)})" d="${M.d}" fill="${ink}"/>` +
    t("first", 540, 236, 0.8, ink) + t("last", 540, 326, 0.8, ink) + t("tag", 543, 396, 0.32, muted) + t("url", 543, 466, 0.26, dark ? C.accent : "#d6286a"),
  [1200, 630]);
}
files["og-dark.svg"] = og(true);
files["og-light.svg"] = og(false);

// ---- animated (SVG + CSS, no script). All honour prefers-reduced-motion and the viewer's colour scheme.
const revealD = (() => {
  const p = (deg: number) => `${(M.R * Math.cos((deg * Math.PI) / 180)).toFixed(2)} ${(M.R * Math.sin((deg * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(M.head + 8)} A${M.R} ${M.R} 0 0 0 ${p(M.head - 130)} A${M.R} ${M.R} 0 0 0 ${p(M.head - 260)} A${M.R} ${M.R} 0 0 0 ${p(M.head - 380)}`;
})();
const rm = (css: string) => `@media (prefers-reduced-motion:reduce){${css}}`;
files["mark-draw.svg"] = svg(markVB, schemeInk(".b") +
  `<style>.r{fill:none;stroke:#fff;stroke-dasharray:1 1;animation:d 1.3s cubic-bezier(.77,0,.175,1) both}@keyframes d{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}${rm(".r{animation:none}")}</style>` +
  `<mask id="m" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120"><path class="r" d="${revealD}" pathLength="1" stroke-width="${M.W + 16}"/></mask><path class="b" d="${M.d}" mask="url(#m)"/>`);
files["mark-idle.svg"] = svg(markVB, schemeInk(".b") +
  `<style>g,.b{transform-box:view-box;transform-origin:0 0}g{animation:s 24s linear infinite}.b{animation:br 6s ease-in-out infinite}@keyframes s{to{transform:rotate(360deg)}}@keyframes br{50%{transform:scale(.955)}}${rm("g,.b{animation:none}")}</style>` +
  `<g><path class="b" d="${M.d}"/></g>`);
files["mark-loader.svg"] = svg(markVB, schemeInk(".b") +
  `<style>g{transform-box:view-box;transform-origin:0 0;animation:s 1.4s cubic-bezier(.55,.15,.45,.85) infinite}@keyframes s{to{transform:rotate(360deg)}}@keyframes p{50%{opacity:.45}}${rm("g{animation:p 1.6s ease-in-out infinite}")}</style>` +
  `<g><path class="b" d="${K.d}"/></g>`);

mkdirSync(OUT, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(`${OUT}/${name}`, body);

// ---- rasters
const png = (s: string, out: string) => sharp(Buffer.from(s)).png({ compressionLevel: 9 }).toFile(`${OUT}/${out}`);
const sized = (s: string, px: number) => s.replace("<svg ", `<svg width="${px}" height="${px}" `);
await Promise.all([
  png(sized(files["mark-light.svg"], 1024), "mark-light-1024.png"),
  png(sized(files["mark-dark.svg"], 1024), "mark-dark-1024.png"),
  png(tile(180, C.night, C.snow, 0.6), "apple-touch-icon.png"),
  png(tile(192, C.night, C.snow, 0.62, 0.22), "icon-192.png"),
  png(tile(512, C.night, C.snow, 0.62, 0.22), "icon-512.png"),
  png(tile(192, C.night, C.snow, 0.5), "icon-maskable-192.png"), // ring inside the 80% safe circle
  png(tile(512, C.night, C.snow, 0.5), "icon-maskable-512.png"),
  png(files["og-dark.svg"], "og-dark.png"),
  png(files["og-light.svg"], "og-light.png"),
]);

/** A .ico holding PNG images (valid since Vista; every current browser reads it). */
function ico(images: { px: number; buf: Buffer }[]) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2); // type 1 = icon
  head.writeUInt16LE(images.length, 4);
  let off = head.length;
  images.forEach(({ px, buf }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(px % 256, e); // 0 means 256
    head.writeUInt8(px % 256, e + 1);
    head.writeUInt16LE(1, e + 4); // colour planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(buf.length, e + 8);
    head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...images.map((im) => im.buf)]);
}
// 16 and 32 use the small optical size; 48 (Google's minimum multiple) the full mark
const icoImgs = await Promise.all([16, 32, 48].map(async (px) => ({ px, buf: await sharp(Buffer.from(tile(px, "none", C.ink, 0.94, 0, px < 48))).png().toBuffer() })));
writeFileSync(`${OUT}/favicon.ico`, ico(icoImgs));

// ---- wire into the app's file-based metadata
copyFileSync(`${OUT}/favicon.ico`, "app/favicon.ico");
copyFileSync(`${OUT}/favicon.svg`, "app/icon.svg");
copyFileSync(`${OUT}/apple-touch-icon.png`, "app/apple-icon.png");
copyFileSync(`${OUT}/og-dark.png`, "app/opengraph-image.png");
console.log(`brand: ${Object.keys(files).length} svg + 9 png + favicon.ico -> ${OUT}/`);
