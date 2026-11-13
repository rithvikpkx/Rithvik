"use client";
import KineticName, { type Paint } from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Stamps each letter's own width (CSS px) once, so its hover dimension can print it through a CSS counter. */
const paint: Paint = (el) => { if (!el.style.getPropertyValue("--dw")) el.style.setProperty("--dw", String(Math.round(el.getBoundingClientRect().width))); };

/** Blueprint: the name is lettered over its construction lines (cap line, baseline) and inked on load; a letter near
 *  the pointer drops back to its construction view (outline, its cell boxed, its width dimensioned above it). Precise,
 *  so it barely moves. */
export default function BlueprintName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="blueprint" feel={{ radius: 1.3, push: 0.012, drag: 0.012, attack: 9, release: 2.2 }} paint={paint} />;
}
