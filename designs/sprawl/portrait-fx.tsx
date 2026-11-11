"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";

/** Sprawl: the portrait as an AR hologram. Luminance is recast in a cyan-to-white projector ramp, the red channel
 *  slips sideways (chromatic aberration), then scanlines, a rolling scan band, a face lock and a data column sit on top. */
export default function SprawlPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="sprawl" label="holo · scan locked" filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feComponentTransfer result="h">
        <feFuncR type="table" tableValues="0.02 0.04 0.1 0.62 1" />
        <feFuncG type="table" tableValues="0.02 0.2 0.72 0.95 1" />
        <feFuncB type="table" tableValues="0.1 0.42 0.88 0.98 1" />
      </feComponentTransfer>
      <feColorMatrix in="h" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 .55 0 0  0 0 0 1 0" result="r" />
      <feOffset in="r" dx="4" result="ro" />
      <feColorMatrix in="h" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
      <feBlend in="ro" in2="gb" mode="screen" />
    </>}>
      <span className="sp-pfx-lines" />
      <span className="sp-pfx-band" />
      <span className="sp-pfx-lock"><i /></span>
      <span className="sp-pfx-data"><b>ID 7F·3A</b><b>MATCH 98.2</b><b>DEPTH 0.61</b></span>
    </PhotoFx>
  );
}
