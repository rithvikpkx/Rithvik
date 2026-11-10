"use client";
import PhotoFx, { PHOTO_SRC } from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

/** Stipple: the portrait as a two-plate halftone print. A dot screen is multiplied over the softened greyscale
 *  photo and thresholded (CSS contrast), so dot size follows tone; the ink plate prints on the paper colour and a
 *  vermilion plate sits slightly off register. */
export default function StipplePortrait({ on }: { on: boolean }) {
  const plate = (cls: string) => (
    <span className={`st-pfx-plate ${cls}`}><span className="st-pfx-ht">
      {/* eslint-disable-next-line @next/next/no-img-element -- the source of a CSS halftone, fetched on the first click */}
      <img src={PHOTO_SRC} alt="" decoding="async" />
    </span></span>
  );
  return (
    <PhotoFx on={on} look="stipple" label="plate ii · 85 lpi" noPhoto>
      {plate("st-pfx-red")}
      {plate("st-pfx-ink")}
    </PhotoFx>
  );
}
