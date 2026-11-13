"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Nimbus: letters near the pointer puff up like cumulus (the variable weight swells), float up and drift with the
 *  pointer, shedding a little pixel cloud that rises and thins. Pure CSS on the kinetic variables. */
export default function NimbusName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="nimbus" feel={{ push: 0.06, drag: 0.1, release: 1.4, stiff: 70, damp: 9 }} />;
}
