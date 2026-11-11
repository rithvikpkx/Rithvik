"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";

/** Stone: the portrait as a carved relief. Its luminance becomes depth in a block of sandstone (grain from noise),
 *  lit low from the side so every feature casts a shadow, the way a carving reads in late light. */
export default function StonePortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="stone" label="relief · sandstone" filter={<>
      <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="a0" />
      <feGaussianBlur in="a0" stdDeviation="1.4" result="a" />
      <feTurbulence type="fractalNoise" baseFrequency=".55" numOctaves="3" seed="5" result="grain" />
      <feComposite in="a" in2="grain" operator="arithmetic" k2=".9" k3=".12" result="hgt" />
      <feDiffuseLighting in="hgt" surfaceScale="6" diffuseConstant="1.25" lightingColor="#F6E2BC" result="lit">
        <feDistantLight azimuth="215" elevation="34" />
      </feDiffuseLighting>
      <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .66  0 0 0 0 .55  0 0 0 0 .42  0 0 0 0 1" result="stone" />
      <feComposite in="lit" in2="stone" operator="arithmetic" k1="1.05" k4="-.04" />
    </>}>
      <span className="sn-pfx-dust" />
    </PhotoFx>
  );
}
