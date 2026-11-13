"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// the photo sinks into the storm's indigo, so only the charge on its edges reads
const NIGHT = "0.06 0.1 0.03 0 0  0.07 0.12 0.04 0 0.01  0.16 0.26 0.12 0 0.05  0 0 0 1 0";

/** Volt: an electric edge glow. Every edge in the photo (a Laplacian of its luminance) carries current: cyan-white
 *  lines with a violet corona over the portrait dimmed to the storm's indigo, flickering like a live discharge. */
export default function VoltPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="volt" label="live · 40 kV" filter={<>
      <feColorMatrix in="SourceGraphic" type="matrix" values={NIGHT} result="dark" />
      <feColorMatrix in="SourceGraphic" type="matrix" values={LUM} />
      <feGaussianBlur stdDeviation=".6" />
      <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" />
      <feComponentTransfer result="edge"><feFuncR type="linear" slope="5" intercept="-.08" /><feFuncG type="linear" slope="5" intercept="-.08" /><feFuncB type="linear" slope="5" intercept="-.08" /></feComponentTransfer>
      <feColorMatrix in="edge" type="matrix" values="0.55 0 0 0 0  0.95 0 0 0 0  1 0 0 0 0  0 0 0 1 0" result="cyan" />
      <feGaussianBlur in="edge" stdDeviation="2.4" result="b" />
      <feColorMatrix in="b" type="matrix" values="0.66 0 0 0 0  0.55 0 0 0 0  1 0 0 0 0  0 0 0 1 0" result="corona" />
      <feComposite in="dark" in2="corona" operator="arithmetic" k2="1" k3="1.2" result="c1" />
      <feComposite in="c1" in2="cyan" operator="arithmetic" k2="1" k3="1.3" />
    </>}>
      <span className="vt-pfx-flick" />
    </PhotoFx>
  );
}
