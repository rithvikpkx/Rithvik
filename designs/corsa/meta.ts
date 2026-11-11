import type { DesignMeta } from "@/lib/designs/types";

/** Corsa: a night garage with a Rosso Corsa Daytona SP3 on a turntable. No shared shader: its hero is a three.js
 *  scene (designs/corsa/scene.ts), the one documented exception to the single-WebGL-context rule, loaded only while
 *  this look is active and disposed on switch. */
export const META: DesignMeta = {
  id: "corsa", name: "Corsa", mood: "rosso corsa, night garage", dark: true,
  keywords: ["corsa", "car", "cars", "racing", "race", "motorsport", "ferrari", "rosso", "red", "supercar", "hypercar", "f1", "formula", "garage", "track", "speed", "3d"],
  swatch: ["#0B0B0D", "#D40000", "#F4F1EA", "#F6C400"],
  cardFont: "\"Saira\", system-ui, sans-serif",
  fonts: "family=Saira:ital,wdth,wght@0,50..125,100..900;1,50..125,100..900&family=JetBrains+Mono:wght@400..700",
  load: () => import("@/designs/corsa"),
};
