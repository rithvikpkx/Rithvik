"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import "./fx.css";

const CELL = 9; // px per pixel-art cell
const LUM = "0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0";

/** Nimbus: the portrait as sky pixel art. One sample per cell (flood + tile + composite), dilated into blocks,
 *  then posterised onto the day-sky palette (ink, sky, mid, pale, white); a checker dither sits on top. */
export default function NimbusPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="nimbus" label="8-bit sky" filter={<>
      <feFlood x={CELL / 2} y={CELL / 2} width="1" height="1" floodColor="#fff" result="dot" />
      <feComposite in="dot" width={CELL} height={CELL} result="cell" />
      <feTile in="cell" result="grid" />
      <feComposite in="SourceGraphic" in2="grid" operator="in" result="s" />
      <feMorphology in="s" operator="dilate" radius={CELL / 2} result="px" />
      <feColorMatrix in="px" type="matrix" values={LUM} />
      <feComponentTransfer>
        <feFuncR type="discrete" tableValues="0.055 0.039 0.424 0.769 1 1" />
        <feFuncG type="discrete" tableValues="0.106 0.608 0.769 0.902 1 1" />
        <feFuncB type="discrete" tableValues="0.169 1 1 1 1 1" />
      </feComponentTransfer>
    </>}>
      <span className="nb-pfx-dither" />
    </PhotoFx>
  );
}
