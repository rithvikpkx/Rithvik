"use client";
import KineticName from "@/components/site/kinetic/KineticName";

/** Grove: the name grown from living moss (the #gv-moss filter on each letter). Under the pointer the strands lean
 *  away like fur in a breath of wind and the small flowers tucked in the moss open; they close again slowly.
 *  Pure CSS on the kinetic variables (grove.css). */
export default function GroveName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="grove" feel={{ attack: 6, release: 0.8, push: 0.03, drag: 0.05, stiff: 120, damp: 9, radius: 1.5 }} />;
}
