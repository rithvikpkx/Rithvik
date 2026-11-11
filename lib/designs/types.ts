import type { ComponentType } from "react";
import type { Content } from "@/lib/content/types";

/** One GPU shader per design (docs/mockups/v7/CONTRACT.md "Shader"). The runtime
 *  prepends the shared head (precision, u_res/u_time/u_mouse/u_scroll/u_dark,
 *  u_c0..u_c3, hash21/vnoise/snoise/fbm). */
export type ShaderSpec = {
  source: string; // GLSL ES 1.0 body, starting at `void main(){`
  colors: [string, string, string, string]; // → u_c0..u_c3
  scale: number; // 0.35–0.6 of CSS px × DPR (runtime adapts below this)
  host?: string; // CSS selector of the element hosting the canvas; omit = fixed full-screen
  /** Optional particle pass, drawn over the background with additive blending in the same context. Each point gets
   *  `attribute vec4 a_seed` (four fixed randoms); `vertex` writes gl_Position/gl_PointSize, `fragment` the colour.
   *  Both get the shared head. Up to `count` points; the runtime draws fewer on small screens or slow frames. */
  points?: { count: number; vertex: string; fragment: string };
};

/** Props every design (and Classic) receives. */
export type DesignProps = { content: Content };

/** A registered design. `kind: "palette"` entries are the legacy themes rendered by Classic. */
export type DesignMeta = {
  id: string;
  name: string;
  mood: string;
  dark: boolean;
  keywords: string[]; // agent `/theme <word>` matching
  swatch: [string, string, string, string]; // dial / switcher colours
  cardFont: string;
  fonts?: string; // Google Fonts css2 query, no host
  shader?: ShaderSpec;
  load: () => Promise<{ default: ComponentType<DesignProps> }>; // lazy (next/dynamic)
};
