// Lucid's glass lenses, kept pure so they can be tested. A lens is an SVG filter that bends whatever sits behind an
// element (used as `backdrop-filter: url(#id)`, Chromium only) or a photo (`filter: url(#id)`): a displacement map
// drawn as a tiny SVG (red ramps left to right, blue top to bottom, a neutral grey core), read three times at
// slightly different strengths so the edge splits into red, green and blue like real dispersion.

export type Lens = {
  /** Element box, px. */
  w: number;
  h: number;
  /** Corner radius, px (clamped to a pill / circle). */
  r: number;
  /** Displacement strength, px (negative pulls the outside in, like a thick rim). */
  scale: number;
  /** Extra strength per colour channel, px: the dispersion. */
  split?: number;
  /** Frost under the bend, px (0 = clear glass). */
  frost?: number;
};

const n = (v: number) => Math.round(v * 10) / 10;

/** The bezel: how far in from the edge the glass curves, px. Thick on big panels, a third of a small button. */
export const bezel = (w: number, h: number) => Math.max(4, Math.min(28, Math.min(w, h) * 0.32));

/** A lens's size class: sizes rounded to 4px so many same-sized buttons share one filter. */
export function lensKey({ w, h, r, scale, split = 0, frost = 0 }: Lens): string {
  const q = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  return `${q(w)}x${q(h)}r${Math.round(Math.min(r, Math.min(w, h) / 2))}s${Math.round(scale)}d${Math.round(split)}f${Math.round(frost * 2)}`;
}

/** The displacement map as an SVG data URI: R encodes x, B encodes y, mid-grey (0.5) means "no bend". The grey core
 *  is blurred into the ramps, so the bend is zero in the middle and grows across the bezel to the rim. */
export function lensMap(w: number, h: number, r: number): string {
  const W = Math.max(4, Math.round(w)), H = Math.max(4, Math.round(h)), R = n(Math.min(r, W / 2, H / 2));
  const b = bezel(W, H), ri = n(Math.max(0, R - b * 0.6));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="x" x1="0" x2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>` +
    `<linearGradient id="y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>` +
    `<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n(b * 0.42)}"/></filter></defs>` +
    `<rect width="${W}" height="${H}" fill="#000"/>` +
    `<rect width="${W}" height="${H}" rx="${R}" fill="url(#x)"/>` +
    `<rect width="${W}" height="${H}" rx="${R}" fill="url(#y)" style="mix-blend-mode:difference"/>` +
    `<rect x="${n(b)}" y="${n(b)}" width="${n(Math.max(1, W - 2 * b))}" height="${n(Math.max(1, H - 2 * b))}" rx="${ri}" fill="#808080" filter="url(#b)"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Isolates one colour channel of a displaced copy (the alpha stays, so the three can be screened together). */
const CH = ["1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0", "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0", "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"];

/** The filter primitives for a lens (no <filter> wrapper): optional frost, then three displaced reads (one per colour
 *  channel, each a little stronger) screened back together. With `split` 0 it is a single read. */
export function lensPrimitives({ w, h, r, scale, split = 0, frost = 0 }: Lens): string {
  const W = Math.max(4, Math.round(w)), H = Math.max(4, Math.round(h));
  const src = frost > 0 ? "f" : "SourceGraphic";
  let s = `<feImage href="${lensMap(W, H, r)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" result="map"/>`;
  if (frost > 0) s += `<feGaussianBlur in="SourceGraphic" stdDeviation="${n(frost)}" result="f"/>`;
  if (!split) return s + `<feDisplacementMap in="${src}" in2="map" scale="${n(scale)}" xChannelSelector="R" yChannelSelector="B"/>`;
  CH.forEach((m, i) => {
    s += `<feDisplacementMap in="${src}" in2="map" scale="${n(scale + split * i * Math.sign(scale || 1))}" xChannelSelector="R" yChannelSelector="B" result="d${i}"/>`;
    s += `<feColorMatrix in="d${i}" type="matrix" values="${m}" result="c${i}"/>`;
  });
  return s + `<feBlend in="c0" in2="c1" mode="screen" result="c01"/><feBlend in="c01" in2="c2" mode="screen"/>`;
}

/** A whole <filter> element's markup for a lens, sized to the element in user space (what backdrop-filter expects). */
export function lensFilter(id: string, lens: Lens): string {
  const W = Math.max(4, Math.round(lens.w)), H = Math.max(4, Math.round(lens.h));
  return `<filter id="${id}" x="0" y="0" width="${W}" height="${H}" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">${lensPrimitives(lens)}</filter>`;
}

/** How hard a panel bends: proportional to its smaller side, so a button and a header bar read as the same glass. */
export const strength = (w: number, h: number, bulge = 1) => -Math.min(70, Math.max(14, Math.min(w, h) * 0.55)) * bulge;

/** A corner radius in px from a computed `border-radius` (first value), clamped to half the smaller side. */
export function radiusPx(css: string, w: number, h: number): number {
  const v = css.trim().split(/\s+/)[0] ?? "0", half = Math.min(w, h) / 2;
  const px = v.endsWith("%") ? (parseFloat(v) / 100) * Math.min(w, h) : parseFloat(v);
  return Math.max(0, Math.min(half, Number.isFinite(px) ? px : 0));
}
