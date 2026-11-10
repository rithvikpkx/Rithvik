"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// face landmarks in the photo's 540x540 frame: brows, eyes, nose, mouth and the jaw line
const JAW = "190,250 196,292 212,322 238,342 268,348 298,342 324,322 342,292 352,252";
const PTS: [number, number][] = [[208, 182], [232, 176], [256, 186], [286, 186], [310, 180], [334, 186], [229, 201], [309, 205], [269, 222], [270, 248], [254, 262], [286, 262], [247, 287], [268, 292], [292, 287]];

/** Tracker: what the detector sees. Edges (a convolution) over a posterised frame, a face box with landmarks and
 *  a mesh, and the person box; labels in the look's class colours. */
export default function TrackerPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="tracker" label="cv · face 0.99" filter={<>
      <feColorMatrix type="matrix" values={LUM} result="l" />
      <feComponentTransfer in="l" result="p"><feFuncR type="discrete" tableValues="0.16 0.42 0.66 0.9" /><feFuncG type="discrete" tableValues="0.17 0.43 0.67 0.9" /><feFuncB type="discrete" tableValues="0.2 0.46 0.7 0.92" /></feComponentTransfer>
      <feConvolveMatrix in="l" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e" />
      <feColorMatrix in="e" type="matrix" values="0 0 0 0 0.12 0 0 0 0 0.23 0 0 0 0 1 4 4 4 0 0" result="ec" />
      <feComposite in="ec" in2="p" operator="over" />
    </>}>
      <svg className="tk-pfx-ov" viewBox="0 0 540 540" focusable="false">
        <rect className="tk-pfx-person" x="22" y="22" width="496" height="512" />
        <rect className="tk-pfx-face" x="176" y="140" width="190" height="220" />
        <polyline className="tk-pfx-mesh" points={JAW} />
        <polyline className="tk-pfx-mesh" points="229,201 269,222 309,205" />
        <polyline className="tk-pfx-mesh" points="229,201 247,287 268,292 292,287 309,205" />
        <polyline className="tk-pfx-mesh" points="269,222 270,248 254,262" />
        {PTS.map(([x, y], i) => <circle key={i} className="tk-pfx-pt" cx={x} cy={y} r="3.2" />)}
      </svg>
      <b className="tk-pfx-l tk-pfx-l1">face 0.99</b>
      <b className="tk-pfx-l tk-pfx-l2">person 0.97</b>
    </PhotoFx>
  );
}
