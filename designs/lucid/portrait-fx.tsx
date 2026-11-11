"use client";
import { Fragment } from "react";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

// A fisheye lens map in the box's own units: red ramps left to right, blue top to bottom (0.5 = no bend), and a grey
// core fading out toward the rim, so the bend is gentle in the middle and strong at the edge, like a droplet.
const DROP = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none"><defs>` +
  `<linearGradient id="x"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>` +
  `<linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>` +
  `<radialGradient id="c"><stop offset="0" stop-color="#808080" stop-opacity=".8"/><stop offset=".55" stop-color="#808080" stop-opacity=".45"/><stop offset="1" stop-color="#808080" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="100" height="100" fill="#000"/><rect width="100" height="100" fill="url(#x)"/>` +
  `<rect width="100" height="100" fill="url(#y)" style="mix-blend-mode:difference"/><rect width="100" height="100" fill="url(#c)"/></svg>`,
)}`;
const CH = ["1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0", "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0", "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"];

/** Lucid: the face seen through a thick glass droplet. The photo is magnified and bent harder toward the rim, each
 *  colour channel a little apart (the fringe a real lens throws), then lit: a soft crescent of sky on top, a sharp
 *  glint, a caustic pooled at the bottom and a dark meniscus at the edge. */
export default function LucidPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="lucid" label="through glass" filter={<>
      <feImage href={DROP} x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map" />
      {CH.map((m, i) => (
        <Fragment key={i}>
          <feDisplacementMap in="SourceGraphic" in2="map" scale={-(46 + i * 7)} xChannelSelector="R" yChannelSelector="B" result={`d${i}`} />
          <feColorMatrix in={`d${i}`} type="matrix" values={m} result={`c${i}`} />
        </Fragment>
      ))}
      <feBlend in="c0" in2="c1" mode="screen" result="c01" />
      <feBlend in="c01" in2="c2" mode="screen" result="rgb" />
      <feColorMatrix in="rgb" type="saturate" values="1.18" />
    </>}>
      <span className="lx-pfx-rim" />
      <span className="lx-pfx-hi" />
      <span className="lx-pfx-glint" />
    </PhotoFx>
  );
}
