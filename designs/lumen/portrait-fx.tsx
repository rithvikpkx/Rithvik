"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// the gradient map, dark to light: black, indigo, blue, violet, coral, peach, white (one table per channel)
const R = "0 .1 .18 .6 1 1 1", G = "0 .08 .36 .36 .42 .74 1", B = "0 .38 1 1 .24 .56 1";

/** Lumen: the portrait mapped through the light's own gradient (shadows indigo, mid-tones blue to coral, highlights
 *  white) with a soft bloom screened over it, like the face lit by the mesh itself. */
export default function LumenPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="lumen" label="gradient map" filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feComponentTransfer result="map"><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
      <feGaussianBlur in="map" stdDeviation="7" result="glow" />
      <feBlend in="map" in2="glow" mode="screen" />
    </>}>
      <span className="lm-pfx-sheen" />
    </PhotoFx>
  );
}
