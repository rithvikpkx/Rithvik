"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

/** Classic: a duotone print in the active palette (shadows in a deep accent, highlights in a pale one) with a
 *  little film grain. Pure CSS blending, so every palette gets its own. */
export default function ClassicPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="classic" label="duotone">
      <span className="cl-pfx-dark" />
      <span className="cl-pfx-grain" />
    </PhotoFx>
  );
}
