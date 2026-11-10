"use client";
import PhotoFx from "@/components/site/kinetic/PhotoFx";
import { PORTRAIT_ASCII } from "./portrait-ascii";
import "./fx.css";

const H = 640 / PORTRAIT_ASCII.length;

/** Glyph: the portrait rendered as ASCII (precomputed from the photo by scripts/portrait-ascii.mjs), each row
 *  stretched to the frame with textLength, typed in row by row. */
export default function GlyphPortrait({ on }: { on: boolean }) {
  return (
    <PhotoFx on={on} look="glyph" label="$ cat rithvik.jpg | ascii" noPhoto>
      <svg className="gl-pfx-art" viewBox="0 0 640 640" preserveAspectRatio="none" focusable="false">
        {PORTRAIT_ASCII.map((row, i) => (
          <text key={i} x="0" y={((i + 0.82) * H).toFixed(1)} textLength="640" lengthAdjust="spacingAndGlyphs" fontSize={H.toFixed(1)} style={{ animationDelay: `${i * 9}ms` }}>{row.replace(/ /g, "\u00a0")}</text>
        ))}
      </svg>
    </PhotoFx>
  );
}
