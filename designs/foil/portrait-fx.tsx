"use client";
import { useEffect, useRef } from "react";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

/** Feeds the pointer's position over the photo into --mx/--my so the holo layers shift as you move. */
function Tilt() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const fx = ref.current?.parentElement, btn = fx?.closest<HTMLElement>(".pt-photo");
    if (!fx || !btn) return;
    const move = (e: PointerEvent) => {
      const r = btn.getBoundingClientRect();
      fx.style.setProperty("--mx", ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      fx.style.setProperty("--my", ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    };
    btn.addEventListener("pointermove", move);
    return () => btn.removeEventListener("pointermove", move);
  }, []);
  return <span ref={ref} className="fo-pfx-holo" />;
}

/** Foil: a holographic print of the portrait. A silvered greyscale base under a rainbow diffraction layer and
 *  sparkle, both of which shift with the pointer (and drift slowly on their own). */
export default function FoilPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="foil" label="holo · 1 of 1">
      <Tilt />
      <span className="fo-pfx-spark" />
    </PhotoFx>
  );
}
