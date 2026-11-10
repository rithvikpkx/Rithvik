"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import { ramp } from "./heat";
import { readPal } from "./motion";
import "./fx.css";

/** Heat colour from the live palette (iron / rainbow / white hot) plus a shimmer phase for the warp. */
const paint: Paint = (el, l, i, now) => {
  if (l.k < 0.004) { el.style.removeProperty("--hc"); el.style.removeProperty("--w"); return; }
  const [r, g, b] = ramp(0.3 + l.k * 0.7, readPal());
  el.style.setProperty("--hc", `rgb(${r} ${g} ${b})`);
  el.style.setProperty("--w", (Math.sin(now / 95 + i * 1.7) * l.k).toFixed(3)); // heat haze: hotter shimmers harder
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { el.style.removeProperty("--hc"); el.style.removeProperty("--w"); });

/** Thermal: letters heat up through the palette as the pointer passes (fast up, slow cool-down) and warp in the
 *  heat haze, then cool back to white. */
export default function ThermalName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="thermal" feel={{ attack: 7, release: 1.5, push: 0.05, drag: 0.08 }} paint={paint} rest={rest} />;
}
