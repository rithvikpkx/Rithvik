"use client";
import { useState, type ReactNode } from "react";
import "./photofx.css";

export const PHOTO_SRC = "/images/rithvik.jpeg";

type Props = {
  /** Flipped by each click on the portrait (Tether owns the button and its aria-pressed). */
  on: boolean;
  /** The look's id, on `data-pfx`; the design's fx CSS hangs off it. */
  look: string;
  /** Tiny caption shown while on ("thermal", "night vision"). */
  label: string;
  /** SVG filter primitives; rendered as <filter id={`pfx-${look}`}> and applied to the effect's copy of the photo. */
  filter?: ReactNode;
  /** Drop the filtered photo copy (a look that draws the whole effect itself, like ASCII). */
  noPhoto?: boolean;
  /** Overlays above the filtered copy (reticles, scanlines, boxes). */
  children?: ReactNode;
};

/** A per-look photographic effect over the portrait. The real photo underneath is never touched: the effect is a
 *  separate layer (a filtered copy plus overlays) that is mounted on the first click and revealed with a short
 *  clip-path transition (shape per look via --pfx-off/--pfx-on), and hidden again on the next. Nothing loads until
 *  the visitor asks for it. `html.lite` / reduced motion swap instantly. */
export default function PhotoFx({ on, look, label, filter, noPhoto, children }: Props) {
  const [armed, setArmed] = useState(on);
  if (on && !armed) setArmed(true); // mount lazily, then keep it for the reverse transition
  if (!armed) return null;
  const id = `pfx-${look}`;
  return (
    <span className="pfx" data-pfx={look} data-on={on ? "" : undefined} aria-hidden="true">
      {filter && (
        <svg className="pfx-defs" width="0" height="0" focusable="false">
          <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">{filter}</filter>
        </svg>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- a filtered copy of the portrait, fetched on the first click */}
      {!noPhoto && <img className="pfx-img" src={PHOTO_SRC} alt="" decoding="async" style={filter ? { filter: `url(#${id})` } : undefined} />}
      {children}
      <span className="pfx-scan" />
      <span className="pfx-cap"><b>{label}</b></span>
    </span>
  );
}
