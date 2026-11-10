// The official Purdue P (public/images/purdue-p.svg, Wikimedia Commons "Purdue Boilermakers primary mark color
// on-white"), as the one source every look's education object draws from. Never redraw or distort it: a look
// may change only colour, material and effects (CSS on the layers below, or the masks in purdue.css).
import type { ReactNode, SVGProps } from "react";
import "./purdue.css";

export const P_VB = "0 0 65.645 35.104";
export const P_ASPECT = 65.645 / 35.104;
const OUT = "M0,35.104,5.508,22.168h7.081l3.931-9.238H9.455l5.506-12.93H53.998c3.43,0,8.251.397,10.521,3.832,2.283,3.454.554,7.515-.478,9.941-2.79,6.553-6.824,10.91705-17.453,10.91705H39.244L34.811,35.104Z";
/** The counter (the P's bowl hole). */
export const P_HOLE = "M47.318,10.53192H35.488l-1.543,3.625H44.711a3.97967,3.97967,0,0,0,3.79-2.3c.214-.50695.228-.858.146-.982-.079-.119-.457-.343-1.329-.343Z";
/** The silhouette with the counter cut out (even-odd). */
export const P_SIL = `${OUT}${P_HOLE}`;
export const P_RING = "M62.518,5.154c-1.241-1.88-3.95-2.756-8.519-2.756H16.548l-3.464,8.134h7.065L14.173,24.566H7.094L3.629,32.707H33.226l3.467-8.141h-7.18l.968-2.273H46.589c10.36,0,13.123-4.474,15.245-9.458,1.142-2.684,2.134-5.487.684-7.681m-27.03,5.378h11.83c.872,0,1.25.22406,1.329.34406.082.122.068.474-.146.981a3.97822,3.97822,0,0,1-3.789,2.3H33.945Z";
export const P_FACE = "M53.999,3.647H17.371l-2.401,5.64h7.067l-7.038,16.526H7.919l-2.404,5.646H32.402l2.403-5.646H27.627l2.031-4.769H46.589c9.705,0,12.145-4.111,14.098-8.698,1.954-4.589,3.017-8.699-6.688-8.699M44.712,15.404H32.059l2.605-6.11694H47.318c2.239,0,3.142,1.151,2.329,3.059a5.17688,5.17688,0,0,1-4.935,3.058";

/** The P as four stacked layers (outline `.pp-o`, counter `.pp-c`, ring `.pp-r`, face `.pp-f`), officially coloured
 *  until a look restyles them (any svg prop passes through, e.g. className, x/y/width to nest it). `defs` hold the look's gradients/filters; `children` draw on top, in P units
 *  (65.645 x 35.104), so overlays land on the true shape. */
export function PurdueP({ defs, children, ...rest }: SVGProps<SVGSVGElement> & { defs?: ReactNode }) {
  return (
    <svg viewBox={P_VB} focusable="false" overflow="visible" {...rest}>
      {defs && <defs>{defs}</defs>}
      <path className="pp-o" fillRule="evenodd" d={P_SIL} />
      <path className="pp-c" d={P_HOLE} />
      <path className="pp-r" d={P_RING} />
      <path className="pp-f" d={P_FACE} />
      {children}
    </svg>
  );
}
