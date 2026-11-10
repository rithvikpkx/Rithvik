"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

/** Prism: the photo split into its red, green and blue plates, the outer two thrown apart (screen-blended back
 *  together, so only the edges fringe), with a band of spectrum crossing it like the prism's beam. */
export default function PrismPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="prism" label="r · g · b" filter={<>
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r" />
      <feOffset in="r" dx="-9" dy="-2" result="r2" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="b" />
      <feOffset in="b" dx="9" dy="2" result="b2" />
      <feBlend in="r2" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b2" mode="screen" />
    </>}>
      <span className="pr-pfx-band" />
    </PhotoFx>
  );
}
