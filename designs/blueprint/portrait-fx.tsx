"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// 1 - l (and 1 - l - .4 for the second pass), alpha forced to 1 so the arithmetic below keeps an opaque result
const INV = "-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1";
const INV2 = "-1 0 0 0 .6 0 -1 0 0 .6 0 0 -1 0 .6 0 0 0 0 1";
// hatch tiles: a triangle-wave ramp along each diagonal, 6px period, seamless when tiled
const ramp = (x1: number, y1: number, x2: number, y2: number) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6"><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" spreadMethod="repeat"><stop offset="0" stop-color="#000"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient><rect width="6" height="6" fill="url(#g)"/></svg>`)}`;
const H1 = ramp(0, 0, 3, 3), H2 = ramp(0, 3, 3, 0);
// 0 = paper white, 1 = Prussian blue ink (applied to the hatch and to the inverted tone alike)
const INK = <><feFuncR type="table" tableValues="0.91 0.07" /><feFuncG type="table" tableValues="0.935 0.23" /><feFuncB type="table" tableValues="0.965 0.46" /></>;

/** Blueprint: the portrait as a hatched cyanotype print. Luminance is engraved against two diagonal line screens
 *  (single hatch in the mid-tones, cross-hatch in the shadows), printed in Prussian blue on white paper with a little
 *  continuous tone under it, and framed by the uneven brushed edge of the emulsion. */
export default function BlueprintPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="blueprint" label="cyanotype · 1:1" filter={<>
      <feColorMatrix in="SourceGraphic" type="matrix" values={LUM} />
      <feGaussianBlur stdDeviation=".5" />
      <feComponentTransfer result="l"><feFuncR type="gamma" exponent="1.2" /><feFuncG type="gamma" exponent="1.2" /><feFuncB type="gamma" exponent="1.2" /></feComponentTransfer>
      <feColorMatrix in="l" type="matrix" values={INV} result="inv" />
      <feColorMatrix in="l" type="matrix" values={INV2} result="inv2" />
      <feImage href={H1} x="0" y="0" width="6" height="6" result="t1" /><feTile in="t1" result="h1" />
      <feImage href={H2} x="0" y="0" width="6" height="6" result="t2" /><feTile in="t2" result="h2" />
      <feComposite in="h1" in2="inv" operator="arithmetic" k2="1" k3="1" k4="-1" result="a1" />
      <feComposite in="h2" in2="inv2" operator="arithmetic" k2="1" k3="1" k4="-1" result="a2" />
      <feBlend in="a1" in2="a2" mode="lighten" />
      <feComponentTransfer result="hatch"><feFuncR type="linear" slope="6" /><feFuncG type="linear" slope="6" /><feFuncB type="linear" slope="6" /></feComponentTransfer>
      <feComponentTransfer in="hatch" result="print">{INK}</feComponentTransfer>
      <feComponentTransfer in="inv" result="tone">{INK}</feComponentTransfer>
      <feComposite in="print" in2="tone" operator="arithmetic" k2=".72" k3=".28" />
    </>}>
      <span className="bp-pfx-edge" />
      <span className="bp-pfx-reg"><i /><i /></span>
    </PhotoFx>
  );
}
