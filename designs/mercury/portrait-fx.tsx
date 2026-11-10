"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// a non-monotonic tone curve is what reads as chrome: mid-tones fold into bright and dark bands
const CHROME = "0.04 0.32 0.86 0.98 0.55 0.2 0.5 0.92 1 0.78 0.9 1";

/** Mercury: the face recast in liquid metal. The photo is rippled, folded through a chrome curve, and lit as a
 *  relief (its luminance is the height map), with a slow highlight sliding across the surface. */
export default function MercuryPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="mercury" label="liquid metal" filter={<>
      <feTurbulence type="fractalNoise" baseFrequency=".011 .016" numOctaves="2" seed="4" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feColorMatrix in="d" type="matrix" values={LUM} />
      <feGaussianBlur stdDeviation="1.8" result="l" />
      <feComponentTransfer in="l" result="c"><feFuncR type="table" tableValues={CHROME} /><feFuncG type="table" tableValues={CHROME} /><feFuncB type="table" tableValues={CHROME} /></feComponentTransfer>
      <feColorMatrix in="l" type="luminanceToAlpha" result="h" />
      <feSpecularLighting in="h" surfaceScale="7" specularConstant="1.05" specularExponent="24" lightingColor="#fff" result="s">
        <feDistantLight azimuth="235" elevation="38" />
      </feSpecularLighting>
      <feComposite in="c" in2="s" operator="arithmetic" k2="0.92" k3="0.75" result="m" />
      <feColorMatrix in="m" type="matrix" values="0.95 0 0 0 0.01 0 0.97 0 0 0.015 0 0 1.04 0 0.03 0 0 0 0 1" />
    </>}>
      <span className="mc-pfx-sheen" />
    </PhotoFx>
  );
}
