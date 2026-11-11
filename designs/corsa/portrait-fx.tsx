"use client";
import type { CSSProperties } from "react";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// luminance -> carbon black, through Rosso Corsa, to a warm white: the onboard feed graded in the car's colours
const R = "0.03 0.2 0.62 0.86 0.98 1";
const G = "0.03 0.02 0.03 0.12 0.62 0.94";
const B = "0.035 0.02 0.03 0.1 0.52 0.86";

/** Corsa: the onboard camera. The face graded black-rosso-white through a carbon weave, with the driver's G-meter
 *  (a dot drifting inside its rings) and a rev-light strip across the top of the frame. */
export default function CorsaPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="corsa" label="Onboard · cam 2 · 1.4 g" filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feComponentTransfer><feFuncR type="linear" slope="1.25" intercept="-0.1" /><feFuncG type="linear" slope="1.25" intercept="-0.1" /><feFuncB type="linear" slope="1.25" intercept="-0.1" /></feComponentTransfer>
      <feComponentTransfer><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
    </>}>
      <span className="co-pfx-weave" />
      <span className="co-pfx-g"><i /></span>
      <span className="co-pfx-revs">{Array.from({ length: 11 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</span>
    </PhotoFx>
  );
}
