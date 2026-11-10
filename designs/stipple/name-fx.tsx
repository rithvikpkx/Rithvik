"use client";
import KineticName, { Letters } from "@/components/site/kinetic/KineticName";
import "./fx.css";

/** Stipple: the inked name under its square lens. Letters near the pointer bleed: a halo of ink spreads from the
 *  glyph, and the look's stipple filter turns it into scattered dots, then it dries back. The crisp vermilion copy
 *  inside the lens is built from the same letter cells so it lines up. */
export default function StippleName({ first, last }: { first: string; last: string }) {
  return (
    <span className="st-name" data-lens data-lens-idle>
      <KineticName first={first} last={last} look="stipple" className="st-name-base" firstClass="st-n1" lastClass="st-n2" feel={{ push: 0.015, drag: 0.03, release: 1.2, attack: 5 }} />
      <span className="st-name-crisp" aria-hidden="true"><span className="st-n1"><Letters text={first} /></span> <span className="st-n2"><Letters text={last} /></span></span>
      <span className="st-lens-frame" aria-hidden="true"><i /><b className="st-lens-xy">x 000 · y 000</b></span>
    </span>
  );
}
