import type { Env, Frame } from "./frame.ts";

/** The five clusters of the constellation. */
export type Family = "print" | "pixel" | "line" | "glitch" | "camera";

/** One slider (or, with `options`, a segmented choice whose value is the option index). */
export type Param = { key: string; label: string; min: number; max: number; step: number; def: number; options?: string[] };

export type Effect = {
  id: string;
  name: string;
  /** One evocative line, shown on the hover card. */
  desc: string;
  family: Family;
  /** Vocabulary tags; the constellation layout and "nearest neighbours" are computed from these. */
  tags: string[];
  params: Param[];
  /** True when the output depends on `env.t` (re-rendered while visible). */
  animated?: boolean;
  /** Pure: reads `src`, returns a new frame of the same size. */
  apply: (src: Frame, p: Record<string, number>, env: Env) => Frame;
};

/** One entry of the stack: an effect, how strongly it mixes over what is beneath it, and its parameter values. */
export type Step = { id: string; intensity: number; params: Record<string, number> };

/** Builds a slider param. */
export const P = (key: string, label: string, min: number, max: number, step: number, def: number, options?: string[]): Param => ({ key, label, min, max, step, def, options });
