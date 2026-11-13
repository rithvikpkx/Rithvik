"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import { hashStr, pad } from "./vision";
import "./fx.css";

/** Each excited letter is a detection: a box that jitters around the glyph (re-estimated every few frames) and an
 *  id + confidence label that settles as the energy peaks. */
const paint: Paint = (el, l, i, now) => {
  const g = el.firstElementChild as HTMLElement;
  if (l.k < 0.05) { el.style.removeProperty("--jx"); el.style.removeProperty("--jy"); return; }
  if (!g.dataset.id) g.dataset.id = `${pad(i + 1)} ${(el.dataset.c ?? "").toLowerCase()} ${(0.81 + (hashStr(`${el.dataset.c}${i}`) % 18) / 100).toFixed(2)}`;
  if ((now / 50 | 0) % 2) return; // a detector updates at ~20 Hz, not every frame
  const j = (1 - l.k) * 5 + 1; // a fresh lock jitters most
  el.style.setProperty("--jx", `${((Math.random() - 0.5) * j).toFixed(1)}px`);
  el.style.setProperty("--jy", `${((Math.random() - 0.5) * j).toFixed(1)}px`);
};
const rest = (_: HTMLElement, els: HTMLElement[]) => els.forEach((el) => { el.style.removeProperty("--jx"); el.style.removeProperty("--jy"); });

/** Tracker: the name stays one tracked "text" object; under the pointer each letter is detected on its own. */
export default function TrackerName({ first, last }: { first: string; last: string }) {
  return (
    <KineticName first={first} last={last} look="tracker" className="tk-name" rootProps={{ "data-tk": "text", "data-tk-label": "name", "data-tk-static": "name 0.99" }}
      feel={{ push: 0.04, drag: 0.04, release: 2.6 }} paint={paint} rest={rest} />
  );
}
