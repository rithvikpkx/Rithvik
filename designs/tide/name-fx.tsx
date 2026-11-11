"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";

/** A travelling wave across the name: each letter rides its own phase, scaled by its energy. */
const paint: Paint = (el, l, i, now) => {
  if (l.k < 0.004) { el.style.removeProperty("--w"); return; }
  el.style.setProperty("--w", (Math.sin(now / 170 - i * 0.75) * l.k).toFixed(3));
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => el.style.removeProperty("--w"));

/** Tide: the pointer passes through the name like a hand through water. Letters ride a wave that travels along the
 *  line, turn sea-glass and lit, and a ring spreads under each one; they settle slowly, the way water does. */
export default function TideName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="tide" feel={{ attack: 6, release: 1.1, push: 0.05, drag: 0.12, stiff: 70, damp: 6, radius: 1.6 }} paint={paint} rest={rest} />;
}
