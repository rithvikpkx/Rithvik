"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Mercury: the name is plain chrome type; letters near the pointer only let the chrome band slide across them
 *  (fx.css reads the pointer energy), with no deformation and no extra layers. */
export default function MercuryName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="mercury" feel={{ push: 0.015, drag: 0.02, release: 1.4, stiff: 90, damp: 9 }} />;
}
