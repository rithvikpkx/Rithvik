"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import "./fx.css";

const POOL = "#%&@$*+=<>/\\|{}[]?!01";

/** A letter near the pointer cycles through ASCII (the real character stays in the DOM, transparent; the
 *  stand-in is a pseudo-element), settling back to itself as its energy fades. */
const paint: Paint = (el, l, i, now) => {
  const g = el.firstElementChild as HTMLElement;
  if (l.k < 0.22) { if (g.dataset.s) delete g.dataset.s; return; }
  if (((now / 55) | 0) % 2 === i % 2) return; // ~18 changes a second, letters out of step
  g.dataset.s = POOL[(Math.random() * POOL.length) | 0];
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => delete (el.firstElementChild as HTMLElement).dataset.s);

/** Glyph: the terminal name. Letters under the pointer scramble through ASCII in the accent colour and step up a
 *  line, then decode back. Keeps the look's big word with the surname set large beneath it. */
export default function GlyphName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="glyph" className="gl-word" firstClass="gl-w1" lastClass="gl-w2" feel={{ push: 0.02, drag: 0.02, release: 3, radius: 1.1 }} paint={paint} rest={rest} />;
}
