"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// luminance -> black-body heat, per channel: shadows soot, mid-tones forge red and orange, highlights white-hot
const R = "0.04 0.32 0.72 0.93 1 1 1 1";
const G = "0.02 0.05 0.15 0.36 0.58 0.76 0.88 0.93";
const B = "0.02 0.02 0.03 0.05 0.1 0.22 0.42 0.62";

/** Ember: a heat-forged print. The face is struck into hot metal (luminance as relief, lit from the forge below),
 *  mapped through the black-body ramp and shimmering in its own heat haze, with embers lifting off it. */
export default function EmberPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="ember" label="forged · 1300 °C" filter={<>
      <feTurbulence type="fractalNoise" baseFrequency=".012 .05" numOctaves="2" seed="11" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feColorMatrix in="d" type="matrix" values={LUM} />
      <feGaussianBlur stdDeviation=".7" result="l" />
      <feComponentTransfer in="l" result="h"><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
      <feColorMatrix in="l" type="luminanceToAlpha" result="a" />
      <feSpecularLighting in="a" surfaceScale="5" specularConstant=".9" specularExponent="18" lightingColor="#FFB45A" result="s">
        <feDistantLight azimuth="90" elevation="28" />
      </feSpecularLighting>
      <feComposite in="h" in2="s" operator="arithmetic" k2="1" k3=".55" />
    </>}>
      <span className="em-pfx-glow" />
      <span className="em-pfx-embers"><i /><i /><i /><i /><i /><i /></span>
    </PhotoFx>
  );
}
