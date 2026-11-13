/** Session replay: records the page with rrweb (lazy-loaded), gzips chunks with CompressionStream and uploads them to
 *  /api/t/replay. Typed text IS recorded; only the admin login (class `rr-block` on its panel, `data-rr-mask` on its
 *  inputs, password and one-time-code fields) is never captured. See docs/plans/v4-overhaul.md "Tracking". */
import type { Engine } from "./engine";

const UPLOAD = "/api/t/replay";
const FLUSH_MS = 10_000;
const CHECKOUT_MS = 30_000;
const MAX_EVENTS = 3000;           // flush early on a mutation storm
const MAX_CHUNK = 500 * 1024;      // server cap is 512 KB gzip'd
const MAX_TOTAL = 7.5 * 1024 * 1024; // server cap is 8 MB per visit

type Ev = { type: number; timestamp: number; data: unknown };

/** Masks a value that must never be recorded: the admin login inputs, password and one-time-code fields. */
export function maskSecret(text: string, el: HTMLElement | null): string {
  const input = el as HTMLInputElement | null;
  const secret = !!input && (input.type === "password" || input.autocomplete === "one-time-code" || !!input.closest?.("[data-rr-mask],.rr-block"));
  return secret ? "*".repeat(text.length) : text;
}

/** gzip via the platform stream (runs off the main thread). */
async function gzip(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Starts recording. Resolves once rrweb is loaded and recording; the engine's stop() ends it. */
export async function startReplay(eng: Engine): Promise<void> {
  if (typeof CompressionStream === "undefined" || eng.stopped) return;
  const { record } = await import("rrweb");
  if (eng.stopped) return;

  let seq = 0;
  try { seq = Number(sessionStorage.getItem("rv_seq") ?? 0) || 0; } catch { /* storage off */ }
  let buf: Ev[] = [];
  let sent = 0;
  let uploading: Promise<void> = Promise.resolve();

  /** Compresses and uploads the buffer as the next chunk (serialised so seq order is preserved). */
  const flush = () => {
    if (!buf.length || seq > 990) return;
    const events = buf;
    buf = [];
    const mine = seq++;
    try { sessionStorage.setItem("rv_seq", String(seq)); } catch { /* storage off */ }
    uploading = uploading.then(async () => {
      const gz = await gzip(JSON.stringify(events));
      if (eng.stopped || gz.length > MAX_CHUNK || sent + gz.length > MAX_TOTAL) { if (sent + gz.length > MAX_TOTAL) stopRec?.(); return; }
      sent += gz.length;
      try {
        const r = await fetch(UPLOAD, {
          method: "POST", body: gz as BodyInit, keepalive: gz.length < 60_000,
          headers: { "content-type": "application/gzip", "x-rv-visit": eng.visitId, "x-rv-seq": String(mine) },
        });
        if (r.ok && (await r.json().catch(() => null))?.owner) eng.stop();
      } catch { /* a lost chunk costs a few seconds of replay, never the page */ }
    });
  };

  const stopRec = record({
    emit(e, isCheckout) {
      if (isCheckout && buf.length) flush(); // each chunk run starts at a fresh full snapshot, so a lost tail still replays
      buf.push(e as unknown as Ev);
      if (buf.length >= MAX_EVENTS) flush();
    },
    checkoutEveryNms: CHECKOUT_MS,
    maskAllInputs: false,                  // owner decision: typed text is recorded
    maskInputOptions: { password: true },
    maskInputFn: maskSecret,
    blockClass: "rr-block",
    maskTextClass: "rr-mask",
    sampling: { mousemove: 100, scroll: 150, input: "last" },
    slimDOMOptions: { script: true, comment: true, headFavicon: true, headWhitespace: true, headMetaDescKeywords: true, headMetaSocial: true, headMetaRobots: true, headMetaHttpEquiv: true, headMetaAuthorship: true, headMetaVerification: true },
    inlineStylesheet: true,
    recordCanvas: false,
    collectFonts: false,
  });

  const timer = setInterval(flush, FLUSH_MS);
  const hide = () => { if (document.visibilityState === "hidden") flush(); };
  document.addEventListener("visibilitychange", hide);
  addEventListener("pagehide", flush); // best effort: compression is async, so a closing tab may lose its last few seconds
  eng.onStop(() => { clearInterval(timer); document.removeEventListener("visibilitychange", hide); removeEventListener("pagehide", flush); stopRec?.(); buf = []; });
}
