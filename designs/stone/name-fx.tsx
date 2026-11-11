"use client";
import KineticName from "@/components/site/kinetic/KineticName";

/** Stone: chiselled capitals cut into the rock. Letters are heavy: the pointer barely moves them, but where it
 *  touches they crack, sag and shed chips and dust, then settle back into place slowly, like rubble resettling.
 *  Pure CSS on the kinetic variables (stone.css). */
export default function StoneName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="stone" feel={{ attack: 5, release: 0.9, push: 0.02, drag: 0.015, stiff: 260, damp: 22, radius: 1.2 }} />;
}
