"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

/** Starlight: a night-vision scope. Luminance is amplified and laid on the green phosphor (feColorMatrix),
 *  with live grain, scanlines, a vignette and a thin reticle over it. */
export default function StarlightPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="starlight" label="NV · gen 3 · x4" filter={<>
      <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" />
      <feComponentTransfer><feFuncR type="gamma" amplitude="1.15" exponent="0.8" offset="0.03" /><feFuncG type="gamma" amplitude="1.15" exponent="0.8" offset="0.03" /><feFuncB type="gamma" amplitude="1.15" exponent="0.8" offset="0.03" /></feComponentTransfer>
      <feColorMatrix type="matrix" values="0.28 0 0 0 0 0 1 0 0 0.02 0 0 0.22 0 0 0 0 0 1 0" />
      <feGaussianBlur stdDeviation="0.6" />
    </>}>
      <span className="sl-pfx-grain" />
      <span className="sl-pfx-lines" />
      <span className="sl-pfx-ret" />
    </PhotoFx>
  );
}
