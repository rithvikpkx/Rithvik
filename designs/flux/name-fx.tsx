"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Flux: near the pointer each letter comes apart into a cloud of dots (a dotted copy that drifts off the solid glyph
 *  while the glyph thins and blurs), and slowly condenses back when the pointer moves on. The particle shader swarms
 *  a share of its nebula into the name's box at the same time, so the letters seem to dissolve into the cloud. */
export default function FluxName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="flux" feel={{ radius: 1.7, push: 0.1, drag: 0.07, attack: 6, release: 1 }} />;
}
