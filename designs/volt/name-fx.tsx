"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";

/** Per letter, per frame while charged: a random jitter, a brightness flicker and an arc angle, so the name crackles
 *  like a live wire rather than wobbling smoothly. Quiet below a little energy. */
const paint: Paint = (el, l) => {
  if (l.k < 0.12) { for (const v of ["--j", "--jy", "--f", "--a"]) el.style.removeProperty(v); return; }
  const r = Math.random(), s = l.k * l.k;
  el.style.setProperty("--j", `${((Math.random() - 0.5) * 7 * s).toFixed(1)}px`);
  el.style.setProperty("--jy", `${((Math.random() - 0.5) * 4 * s).toFixed(1)}px`);
  el.style.setProperty("--f", r < 0.12 * l.k ? "1" : "0"); // an occasional full white flash
  el.style.setProperty("--a", `${Math.round(Math.random() * 360)}deg`);
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { for (const v of ["--j", "--jy", "--f", "--a"]) el.style.removeProperty(v); });

/** Volt: the pointer charges the letters. They snap and jitter, flare electric cyan, and arcs jump off them; the
 *  charge bleeds away quickly once the pointer leaves. */
export default function VoltName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="volt" feel={{ attack: 14, release: 2.6, push: 0.03, drag: 0.04, stiff: 320, damp: 12, radius: 1.4 }} paint={paint} rest={rest} />;
}
