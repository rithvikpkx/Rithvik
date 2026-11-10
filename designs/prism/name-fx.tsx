"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Prism: letters near the pointer refract. Each splits into red and cyan plates thrown apart along the pointer's
 *  side and bends slightly, like type seen through the edge of a glass prism. Pure CSS on the kinetic variables. */
export default function PrismName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="prism" className="pr-name" feel={{ push: 0.05, drag: 0.06, release: 2.2 }} />;
}
