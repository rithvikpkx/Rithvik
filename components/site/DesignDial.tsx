"use client";
import type { CSSProperties } from "react";
import { ThemeDialView, type DialItem } from "@/components/ThemeDial";
import { useDesign } from "./DesignProvider";

/** The old side dial, fanned out with the nine designs, a divider, then the palettes. */
export default function DesignDial() {
  const { entries, current, setDesign } = useDesign();
  const items: DialItem[] = entries.map((e) => e.kind === "design"
    ? { id: e.id, name: e.meta.name, bg: e.meta.swatch[0], fg: e.meta.swatch[1], accent: e.meta.swatch[2], font: e.meta.cardFont }
    : { id: e.id, name: e.name, bg: e.swatch[0], fg: e.swatch[1], accent: e.swatch[2] });
  const cur = items.find((i) => i.id === current) ?? items[0];
  // Designs define no palette vars, so the dial is tinted from the active entry instead.
  const style = { "--bg": cur.bg, "--text": cur.fg, "--accent": cur.accent, "--panel-glass": `color-mix(in srgb, ${cur.bg} 90%, transparent)` } as CSSProperties;
  const split = entries.findIndex((e) => e.kind === "palette");
  return <ThemeDialView items={items} current={current} onSelect={setDesign} dividerAt={split > 0 ? split : undefined} style={style} />;
}
