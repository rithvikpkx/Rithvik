import { makeAtlas } from "./atlas.ts";
import { Cache, runStack } from "./engine.ts";
import type { Frame } from "./frame.ts";
import type { Step } from "./types.ts";
import type { FromWorker, ToWorker } from "./worker.ts";

export type Job = { srcKey: string; steps: Step[]; t: number; cache?: boolean };

/** Renders jobs off the main thread (a module worker), with at most one in flight and the newest edit always winning.
 *  If a worker cannot be made, the same engine runs in a timeout on the main thread. */
export class Runner {
  private worker: Worker | null = null;
  private srcs = new Map<string, Frame>();
  private local = new Cache(24);
  private busy = false;
  private pending: { job: Job; done: (f: Frame) => void } | null = null;
  private id = 0;
  private waiting = new Map<number, { done: (f: Frame) => void; fail: () => void }>();
  /** Fires true when a render starts and false when it ends. */
  onBusy: (b: boolean) => void = () => {};

  constructor() {
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<FromWorker>) => {
        const m = e.data, w = this.waiting.get(m.id);
        if (!w) return;
        this.waiting.delete(m.id);
        if ("error" in m) w.fail(); else w.done({ w: m.w, h: m.h, data: new Uint8ClampedArray(m.buf) });
      };
      this.worker.onerror = () => { this.worker = null; this.waiting.forEach((w) => w.fail()); this.waiting.clear(); };
    } catch { this.worker = null; }
  }

  /** Registers (or replaces) a source frame under `key`, in the worker and locally for the fallback. */
  setSource(key: string, f: Frame) {
    this.srcs.set(key, f);
    this.local.clear();
    this.worker?.postMessage({ type: "src", key, w: f.w, h: f.h, buf: f.data.slice().buffer } satisfies ToWorker);
  }

  /** Renders `job`. While one is in flight a newer call replaces any queued one (`drop` ignores it instead: animation ticks that arrive late). */
  render(job: Job, done: (f: Frame) => void, drop = false) {
    if (this.busy) { if (!drop) this.pending = { job, done }; return; }
    this.busy = true;
    this.onBusy(true);
    const finish = (f?: Frame) => {
      this.busy = false;
      if (f) done(f);
      const next = this.pending;
      this.pending = null;
      if (next) this.render(next.job, next.done); else this.onBusy(false);
    };
    this.run(job).then(finish, () => finish());
  }

  /** One job to completion (used directly by export, which must not be dropped or replaced). */
  run(job: Job): Promise<Frame> {
    return new Promise((resolve, reject) => {
      const w = this.worker;
      if (w) {
        const id = ++this.id;
        this.waiting.set(id, { done: resolve, fail: () => reject(new Error("worker")) });
        w.postMessage({ type: "run", id, srcKey: job.srcKey, steps: job.steps, t: job.t, cache: job.cache !== false } satisfies ToWorker);
        return;
      }
      setTimeout(() => {
        const src = this.srcs.get(job.srcKey);
        if (!src) { reject(new Error("no source")); return; }
        try { resolve(runStack(src, job.steps, { t: job.t, atlas: makeAtlas, cache: job.cache === false ? undefined : this.local, srcKey: job.srcKey })); } catch (e) { reject(e); }
      }, 0);
    });
  }

  destroy() { this.worker?.terminate(); this.worker = null; this.pending = null; this.waiting.clear(); }
}
