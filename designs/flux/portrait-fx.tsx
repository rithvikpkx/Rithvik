"use client";
import PhotoFx, { PHOTO_SRC } from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

// luminance -> light: shadows to deep violet, mid-tones to the cloud's cyan, highlights to white
const R = "0.02 0.22 0.42 0.78 1";
const G = "0.02 0.14 0.7 0.92 1";
const B = "0.06 0.55 0.95 1 1";
const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";

/** Flux: the portrait comes apart into points of light. A fine screen of dots keeps the face; two coarser screens
 *  of the same image drift outward and fade, so the edges keep dissolving into the cloud. */
export default function FluxPortrait({ on }: { on: boolean }) {
  const layer = (cls: string) => (
    // eslint-disable-next-line @next/next/no-img-element -- copies of the portrait, fetched on the first click
    <span className={`fl-pfx-dots ${cls}`}><img src={PHOTO_SRC} alt="" decoding="async" style={{ filter: "url(#pfx-flux)" }} /></span>
  );
  return (
    <PhotoFx on={on} look="flux" label="point cloud" noPhoto filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feComponentTransfer><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
    </>}>
      <span className="fl-pfx-bg" />
      {layer("fl-pfx-c")}
      {layer("fl-pfx-b")}
      {layer("fl-pfx-a")}
    </PhotoFx>
  );
}
