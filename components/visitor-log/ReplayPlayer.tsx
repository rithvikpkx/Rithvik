"use client";
import "rrweb/dist/style.css";
import { useEffect, useRef, useState } from "react";
import type { Replayer } from "rrweb";

type Ev = { type: number; timestamp: number; data: unknown };

/** Fetches one gzip'd chunk and inflates it here (the route sends raw gzip bytes). */
async function chunk(visitId: string, seq: number): Promise<Ev[]> {
  const r = await fetch(`/api/admin/replay?visit=${visitId}&seq=${seq}`);
  if (!r.ok || !r.body) throw new Error(`chunk ${seq}: ${r.status}`);
  return new Response(r.body.pipeThrough(new DecompressionStream("gzip"))).json();
}

/** Session replay for one visit. Nothing downloads until "Load replay": then the chunks (gzip, decompressed in the
 *  browser) are fetched from the admin-only /api/admin/replay, stitched in order, and played by rrweb's Replayer,
 *  which is itself imported lazily. `events` lets the lab harness play fixtures without a backend. */
export default function ReplayPlayer({ visitId, seqs, events }: { visitId: string; seqs: number[]; events?: unknown[] }) {
  const host = useRef<HTMLDivElement>(null);
  const rp = useRef<Replayer | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [why, setWhy] = useState("");
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [skip, setSkip] = useState(true);
  const [pos, setPos] = useState({ t: 0, total: 0 });

  useEffect(() => () => { rp.current?.destroy(); rp.current = null; }, []);

  // Progress readout while playing.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => { const p = rp.current; if (p) setPos((x) => ({ ...x, t: p.getCurrentTime() })); }, 250);
    return () => clearInterval(id);
  }, [playing]);

  /** Fetches and stitches the chunks, builds the Replayer, scales it to the card width, and starts playing. */
  async function load() {
    setStatus("loading");
    try {
      // a missing chunk (pruned, or a failed upload) costs only its own stretch of the replay, not the whole thing
      const got = events ? [] : await Promise.allSettled(seqs.map((s) => chunk(visitId, s)));
      got.forEach((g) => { if (g.status === "rejected") console.warn("[replay]", g.reason); });
      const chunks: Ev[][] = events ? [events as Ev[]] : got.flatMap((g) => (g.status === "fulfilled" ? [g.value] : []));
      const all = chunks.flat().sort((a, b) => a.timestamp - b.timestamp);
      if (all.length < 2 || !host.current) throw new Error("empty");
      const { Replayer } = await import("rrweb");
      host.current.replaceChildren();
      const p = new Replayer(all as never, { root: host.current, skipInactive: skip, speed, mouseTail: { strokeStyle: "#ef4444" }, showWarning: false });
      const fit = (w: number, h: number) => {
        // The stage is still `hidden` (width 0) while the Replayer builds, so measure its parent.
        const s = Math.min(1, (host.current?.parentElement?.clientWidth || w) / w);
        p.wrapper.style.transform = `scale(${s})`;
        p.wrapper.style.transformOrigin = "top left";
        if (host.current) host.current.style.height = `${h * s}px`;
      };
      p.on("resize", (d: unknown) => { const { width, height } = d as { width: number; height: number }; fit(width, height); });
      p.on("finish", () => setPlaying(false));
      rp.current = p;
      setPos({ t: 0, total: p.getMetaData().totalTime });
      p.play();
      setPlaying(true);
      setStatus("ready");
    } catch (e) {
      console.error("[replay]", e);
      setWhy(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  const toggle = () => { const p = rp.current; if (!p) return; if (playing) { p.pause(); setPlaying(false); } else { p.play(p.getCurrentTime() >= pos.total ? 0 : p.getCurrentTime()); setPlaying(true); } };
  const seek = (t: number) => { rp.current?.play(t); setPlaying(true); setPos((x) => ({ ...x, t })); };

  return (
    <div className="alog-replay">
      {status === "idle" && <button type="button" onClick={load}>Load replay ({seqs.length || 1} chunk{seqs.length === 1 ? "" : "s"})</button>}
      {status === "loading" && <p className="alog-muted">Loading replay…</p>}
      {status === "error" && <p className="alog-err">Could not load this replay{why === "empty" ? " (no recorded frames; it may have expired)" : why ? ` (${why})` : ""}.</p>}
      {status === "ready" && (
        <div className="alog-replay-bar" role="group" aria-label="Replay controls">
          <button type="button" onClick={toggle} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
          <input type="range" min={0} max={pos.total} value={Math.min(pos.t, pos.total)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position" />
          <span className="alog-mono">{Math.round(pos.t / 1000)}s / {Math.round(pos.total / 1000)}s</span>
          <label>Speed
            <select value={speed} onChange={(e) => { const s = Number(e.target.value); setSpeed(s); rp.current?.setConfig({ speed: s }); }}>
              {[1, 2, 4, 8].map((s) => <option key={s} value={s}>{s}x</option>)}
            </select>
          </label>
          <label className="inline"><input type="checkbox" checked={skip} onChange={(e) => { setSkip(e.target.checked); rp.current?.setConfig({ skipInactive: e.target.checked }); }} />Skip idle</label>
        </div>
      )}
      <div ref={host} className="alog-replay-stage" hidden={status !== "ready"} />
    </div>
  );
}
