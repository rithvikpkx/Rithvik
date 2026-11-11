"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// luminance -> a leaf-green duotone: forest shade in the darks, pale new growth in the lights (a chlorophyll print)
const R = "0.04 0.1 0.22 0.42 0.66 0.88 0.96";
const G = "0.1 0.2 0.38 0.58 0.78 0.92 0.98";
const B = "0.06 0.1 0.16 0.26 0.46 0.7 0.86";

/** Grove: a botanical print. The face is printed in leaf greens the way a sun print holds a fern, with the shadows
 *  of real leaves swaying across it and dapples of light breaking through. */
export default function GrovePortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="grove" label="botanical print" filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feComponentTransfer><feFuncR type="table" tableValues={R} /><feFuncG type="table" tableValues={G} /><feFuncB type="table" tableValues={B} /></feComponentTransfer>
    </>}>
      <span className="gv-pfx-shade" />
      <span className="gv-pfx-dapple" />
    </PhotoFx>
  );
}
