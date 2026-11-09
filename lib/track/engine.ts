/** Browser-side tracking engine: queues events, flushes batches to /api/t every 10 s and on page hide, and runs the
 *  circuit breaker. No React, no dependencies; rrweb is loaded separately and lazily (lib/track/replay.ts). */

const ENDPOINT = "/api/t";
const FLUSH_MS = 10_000;
const FIRST_FLUSH_MS = 1_500;
const SAFE_BODY = 50_000; // the server cap is 64 KB; stay well under it
const MAX_FAILS = 3;

export type Emit = (type: string, data?: Record<string, unknown>, at?: number) => void;
export type Engine = {
  visitId: string;
  emit: Emit;
  /** Registers a callback that runs just before every flush (observers use it to report accumulated values). */
  beforeFlush: (fn: () => void) => void;
  /** Sends what is queued; `beacon` uses sendBeacon for page hide. */
  flush: (beacon?: boolean) => void;
  stop: () => void;
  readonly stopped: boolean;
  onStop: (fn: () => void) => void;
};

/** Reads a localStorage dev toggle (`rv-off`, `rv-norec`); false when storage is unavailable. */
export function devFlag(name: string): boolean {
  try { return localStorage.getItem(name) === "1"; } catch { return false; }
}

/** The visit id for this tab: kept in sessionStorage so a reload continues the same visit. */
function visitId(): string {
  try {
    const s = sessionStorage.getItem("rv_vid");
    if (s) return s;
    const id = crypto.randomUUID();
    sessionStorage.setItem("rv_vid", id);
    return id;
  } catch { return crypto.randomUUID(); }
}

/** What the server needs to create the visit (it uses this only on a visit's first batch, but it is cheap enough to send always). */
function context() {
  const p = new URLSearchParams(location.search);
  const utm: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) { const v = p.get(k); if (v) utm[k] = v; }
  return {
    entry: location.pathname + location.search, referrer: document.referrer, utm,
    design: document.documentElement.dataset.design ?? "", viewport: `${innerWidth}x${innerHeight}`,
    screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, lang: navigator.language, languages: (navigator.languages ?? []).join(","),
    webdriver: navigator.webdriver === true,
  };
}

/** Creates and starts the engine. */
export function createEngine(): Engine {
  const vid = visitId();
  let queue: { t: string; at: number; d?: Record<string, unknown> }[] = [];
  let stopped = false;
  let fails = 0;
  const before: (() => void)[] = [];
  const stops: (() => void)[] = [];
  const first = setTimeout(() => flush(), FIRST_FLUSH_MS);
  const timer = setInterval(() => flush(), FLUSH_MS);

  const stop = () => {
    if (stopped) return;
    stopped = true;
    queue = [];
    clearInterval(timer); clearTimeout(first);
    stops.forEach((f) => f());
  };

  /** Posts one body; the response may say the owner is excluded (stop) or that we are failing (breaker). */
  const send = (body: string, beacon: boolean) => {
    if (beacon && navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
    fetch(ENDPOINT, { method: "POST", body, keepalive: body.length < 60_000, headers: { "content-type": "text/plain" } })
      .then(async (r) => {
        if (r.status === 429 || r.status === 413) return stop(); // asked to back off
        if (!r.ok) { if (++fails >= MAX_FAILS) stop(); return; }
        fails = 0;
        if ((await r.json().catch(() => null))?.owner) stop();
      })
      .catch(() => { if (++fails >= MAX_FAILS) stop(); });
  };

  const flush = (beacon = false) => {
    if (stopped) return;
    before.forEach((f) => f());
    while (queue.length) {
      const take: typeof queue = [];
      let size = 600; // context overhead
      while (queue.length && take.length < 100) {
        const n = JSON.stringify(queue[0]).length;
        if (take.length && size + n > SAFE_BODY) break;
        size += n;
        take.push(queue.shift()!);
      }
      send(JSON.stringify({ vid, ctx: context(), e: take }), beacon);
    }
  };

  const emit: Emit = (t, d, at) => {
    if (stopped) return;
    if (queue.length < 500) queue.push({ t, at: at ?? Date.now(), d });
  };

  return {
    visitId: vid, emit, flush, stop,
    beforeFlush: (fn) => { before.push(fn); },
    onStop: (fn) => { stops.push(fn); },
    get stopped() { return stopped; },
  };
}
