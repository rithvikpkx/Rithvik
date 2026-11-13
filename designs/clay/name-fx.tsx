"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Clay: the serif name reacts like a pen pressed harder: letters near the pointer swell in weight, take on clay
 *  ink and tip a little in the direction of the stroke, then ease back to plain ink (fx.css). */
export default function ClayName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="clay" feel={{ attack: 5, release: 1.1, push: 0.035, drag: 0.05, radius: 1.3 }} />;
}
