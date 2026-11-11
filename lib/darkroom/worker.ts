import { makeAtlas } from "./atlas.ts";
import { Cache, runStack } from "./engine.ts";
import type { Frame } from "./frame.ts";
import type { Step } from "./types.ts";

/** Off-main-thread renderer: holds the source frames and a result cache, answers `run` jobs with a pixel buffer. */
export type ToWorker =
  | { type: "src"; key: string; w: number; h: number; buf: ArrayBuffer }
  | { type: "run"; id: number; srcKey: string; steps: Step[]; t: number; cache: boolean };
export type FromWorker = { id: number; w: number; h: number; buf: ArrayBuffer } | { id: number; error: string };

const sources = new Map<string, Frame>();
const cache = new Cache(40);
// the dom lib is on for the whole project, so the worker scope is typed by hand rather than via lib.webworker
const ctx = self as unknown as { onmessage: ((e: MessageEvent<ToWorker>) => void) | null; postMessage: (m: FromWorker, t?: Transferable[]) => void };

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === "src") {
    sources.set(m.key, { w: m.w, h: m.h, data: new Uint8ClampedArray(m.buf) });
    if (sources.size > 3) sources.delete(sources.keys().next().value as string); // keeps the preview, the export and one spare
    return;
  }
  const src = sources.get(m.srcKey);
  if (!src) { ctx.postMessage({ id: m.id, error: "no source" }); return; }
  try {
    const out = runStack(src, m.steps, { t: m.t, atlas: makeAtlas, cache: m.cache ? cache : undefined, srcKey: m.srcKey });
    const buf = out.data.slice().buffer; // a copy: cached frames must stay intact after the transfer
    ctx.postMessage({ id: m.id, w: out.w, h: out.h, buf }, [buf]);
  } catch (err) {
    ctx.postMessage({ id: m.id, error: String(err) });
  }
};
