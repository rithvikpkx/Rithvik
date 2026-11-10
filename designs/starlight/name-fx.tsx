"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Phosphor flicker: an excited letter now and then dips and jitters sideways, like a tube near its limit. */
const paint: Paint = (el, l) => {
  if (l.k < 0.15) { el.style.removeProperty("--f"); el.style.removeProperty("--j"); return; }
  const r = Math.random();
  el.style.setProperty("--f", r < 0.07 ? "0.55" : r < 0.16 ? "0.2" : "0");
  el.style.setProperty("--j", `${r < 0.1 ? ((Math.random() - 0.5) * 6).toFixed(1) : 0}px`);
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { el.style.removeProperty("--f"); el.style.removeProperty("--j"); });

/** Starlight: under the pointer's light the letters bloom white-hot on the phosphor and flicker, then fade back. */
export default function StarlightName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="starlight" feel={{ push: 0.03, drag: 0.03, release: 1.8 }} paint={paint} rest={rest} />;
}
