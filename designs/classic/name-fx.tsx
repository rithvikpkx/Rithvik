"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Classic: the old site's kinetic name, refined. Letters near the pointer gain weight on a spring and
 *  lift, warming towards the palette's accent. */
export default function ClassicName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="classic" feel={{ push: 0.025, drag: 0.03, attack: 12, release: 3.2 }} />;
}
