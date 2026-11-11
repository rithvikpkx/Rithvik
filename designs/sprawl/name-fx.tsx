"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Neon under strain: the closer the pointer, the more a tube buzzes (random brightness dips) and the wider its
 *  glitch slice slips sideways (`--gx`, `--gy` read by fx.css). */
const paint: Paint = (el, l) => {
  if (l.k < 0.02) { el.style.removeProperty("--gx"); el.style.removeProperty("--fl"); return; }
  el.style.setProperty("--gx", `${((Math.random() - 0.5) * l.k * 14).toFixed(1)}px`);
  el.style.setProperty("--gy", `${(Math.random() * 60).toFixed(0)}%`);
  el.style.setProperty("--fl", Math.random() < l.k * 0.35 ? "0.35" : "1");
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { for (const v of ["--gx", "--gy", "--fl"]) el.style.removeProperty(v); });

/** Sprawl: the name as two neon signs, magenta and cyan. Steady at rest (one tube buzzes now and then); near the
 *  pointer the letters flicker and split into a chromatic glitch, then settle back to a clean glow. */
export default function SprawlName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="sprawl" feel={{ push: 0.03, drag: 0.03, attack: 9, release: 2.2 }} paint={paint} rest={rest} />;
}
