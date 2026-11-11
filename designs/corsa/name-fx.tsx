"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Which way the letter is being carried (its spring offset): the streaks trail on the other side. */
const paint: Paint = (el, l) => {
  if (l.k < 0.004) { el.style.removeProperty("--dir"); return; }
  if (Math.abs(l.x) > 0.5) el.style.setProperty("--dir", l.x < 0 ? "-1" : "1");
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => el.style.removeProperty("--dir"));

/** Corsa: the pointer passes the name like a car down the straight. Letters it reaches are dragged along, lean into
 *  the motion and stretch, leaving red speed streaks and a motion-blur ghost behind them (fx.css reads the energy),
 *  then settle back square. */
export default function CorsaName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="corsa" feel={{ radius: 1.6, push: 0.05, drag: 0.1, attack: 10, release: 2.6, stiff: 150, damp: 12 }} paint={paint} rest={rest} />;
}
