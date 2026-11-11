"use client";
import KineticName from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Lucid: the name in thick clear glass. Each letter is a lit glass body (a bright top edge, a clear middle, a
 *  cool caustic at its foot) with split colour fringes; near the pointer a letter swells like a lens, its highlight
 *  sliding toward the light, and wobbles back like jelly (a soft, under-damped spring). */
export default function LucidName({ first, last }: { first: string; last: string }) {
  return <KineticName first={first} last={last} look="lucid" feel={{ radius: 1.4, push: 0.05, drag: 0.04, attack: 7, release: 1.8, stiff: 120, damp: 5.5 }} />;
}
