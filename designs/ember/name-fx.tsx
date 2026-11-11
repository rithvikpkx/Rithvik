"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import { rampAt, type Stop } from "@/designs/elemental/core";

// energy -> colour: forged steel at rest, then (heating) a flash through soot to white-hot; cooling runs it back,
// so a letter fades from white through yellow and orange to red, chars black, and the char flakes off to steel
const HEAT: Stop[] = [[0, "#F4E6D8"], [0.1, "#2A1913"], [0.26, "#8E1A08"], [0.5, "#F0520E"], [0.78, "#FFC247"], [1, "#FFF6E2"]];

/** Per letter: its heat colour and a flicker phase for the flame above it (hotter flickers harder). */
const paint: Paint = (el, l, i, now) => {
  if (l.k < 0.004) { el.style.removeProperty("--hc"); el.style.removeProperty("--w"); return; }
  el.style.setProperty("--hc", rampAt(HEAT, l.k));
  el.style.setProperty("--w", (Math.sin(now / 70 + i * 2.3) * Math.sin(now / 113 + i) * l.k).toFixed(3));
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { el.style.removeProperty("--hc"); el.style.removeProperty("--w"); });

/** Ember: letters ignite as the pointer passes (fast), throw a tongue of flame and embers, then cool slowly through
 *  the black-body colours, char, and flake back to forged steel. */
export default function EmberName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="ember" feel={{ attack: 8, release: 0.75, push: 0.04, drag: 0.07, radius: 1.3 }} paint={paint} rest={rest} />;
}
