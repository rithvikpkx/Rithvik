"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import { ramp } from "./heat";
import { usePal } from "./motion";
import "./fx.css";

const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";
// luminance -> heat: skin tones read hottest, hair and suit warm-ish, the bright backdrop cold
const HEAT = "0.3 0.36 0.46 0.66 0.88 0.98 0.93 0.74 0.46 0.2 0.05";
const STEPS = Array.from({ length: 12 }, (_, i) => i / 11);

/** Thermal: a false-colour IR frame of the portrait in the live palette, with a spot-meter reticle on the face. */
export default function ThermalPortrait({ on }: { on: boolean }) {
  const pal = usePal();
  const cs = STEPS.map((t) => ramp(t, pal));
  const ch = (j: number) => cs.map((c) => (c[j] / 255).toFixed(3)).join(" ");
  return (
    <PhotoFx on={on} look="thermal" label={`IR · ${pal === "white" ? "white hot" : pal} · 36.8 °C`} filter={<>
      <feColorMatrix type="matrix" values={LUM} />
      <feGaussianBlur stdDeviation="1.6" />
      <feComponentTransfer><feFuncR type="table" tableValues={HEAT} /><feFuncG type="table" tableValues={HEAT} /><feFuncB type="table" tableValues={HEAT} /></feComponentTransfer>
      <feComponentTransfer><feFuncR type="table" tableValues={ch(0)} /><feFuncG type="table" tableValues={ch(1)} /><feFuncB type="table" tableValues={ch(2)} /></feComponentTransfer>
    </>}>
      <span className="th-pfx-ret"><i /></span>
      <span className="th-pfx-bar" />
    </PhotoFx>
  );
}
