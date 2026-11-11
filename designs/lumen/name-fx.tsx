"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Lumen: the white name lets light through where the pointer is: nearby letters turn to a mesh of colour lit from the
 *  pointer's side, lift a hair and glow, then settle back to white (fx.css). */
export default function LumenName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="lumen" feel={{ attack: 6, release: 1.3, push: 0.02, drag: 0.03, radius: 1.6 }} />;
}
