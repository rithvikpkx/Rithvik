"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Foil: letters near the pointer tilt towards it like a card in the hand and turn holographic, the rainbow sheen
 *  sliding with the pointer's angle across each letter. Pure CSS on the kinetic variables. */
export default function FoilName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="foil" feel={{ push: 0.03, drag: 0.04, release: 2, radius: 1.7 }} />;
}
