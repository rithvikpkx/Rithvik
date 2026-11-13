"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";

// underwater grade: red drowns first, so shadows sink to deep blue and highlights turn sea-glass
const GRADE = "0.18 0.22 0.1 0 0  0.12 0.62 0.24 0 0.04  0.1 0.36 0.62 0 0.1  0 0 0 1 0";

/** Tide: the portrait under a few feet of clear water. The face wavers in the refraction, takes the sea's colour,
 *  and a caustic net of focused light slides over it, with light shafts and a few bubbles rising. */
export default function TidePortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="tide" label="under the surface" filter={<>
      <feTurbulence type="fractalNoise" baseFrequency=".018 .03" numOctaves="2" seed="21" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G" result="d" />
      <feColorMatrix in="d" type="matrix" values={GRADE} />
    </>}>
      <span className="td-pfx-caustic" />
      <span className="td-pfx-shafts" />
      <span className="td-pfx-bubbles"><i /><i /><i /><i /><i /></span>
    </PhotoFx>
  );
}
