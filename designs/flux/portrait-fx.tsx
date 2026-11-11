"use client";
import PhotoFx, { PHOTO_SRC } from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

// luminance (lifted, so skin reads bright) -> light: shadows to deep violet, mid-tones to the cloud's cyan, highlights to white
const R = "0.06 0.45 0.75 0.95 1";
const G = "0.05 0.42 0.88 1 1";
const B = "0.15 0.8 1 1 1";
// grey = luminance; alpha keys out the white studio backdrop (lum above ~.93), so only the figure is made of points
const KEY = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 -1.276 -4.291 -0.433 0 5.6";

/** Flux: the portrait comes apart into points of light. A fine screen of dots keeps the face; two coarser screens
 *  of the same image drift outward and fade, so the edges keep dissolving into the cloud. */
export default function FluxPortrait({ on }: { on: boolean }) {
  const layer = (cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- copies of the portrait, fetched on the first click
    <span className={`fl-pfx-dots ${cls}`}><img src={PHOTO_SRC} alt="" decoding="async" style={{ filter: "url(#pfx-flux)" }} /></span>
  );
  return (
    <PhotoFx on={on} look="flux" label="point cloud" noPhoto filter={<>
      <feColorMatrix type="matrix" values={KEY} />
      <feComponentTransfer><feFuncR type="gamma" exponent=".45" /><feFuncG type="gamma" exponent=".45" /><feFuncB type="gamma" exponent=".45" /></feComponentTransfer>
      <feComponentTransfer><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
    </>}>
      <span className="fl-pfx-bg" />
      {layer("fl-pfx-c")}
      {layer("fl-pfx-b")}
      {layer("fl-pfx-a")}
    </PhotoFx>
  );
}
