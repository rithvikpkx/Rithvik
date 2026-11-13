"use client";
import { useEffect, useRef, useState } from "react";
import { useSite } from "../SiteProvider";
import { Deck, DEFAULTS, type DeckParams, type Layer } from "./deck";
import { createScope, type Scope } from "./scope";
import Knob from "./Knob";
import { Icon as Ic } from "../Glyph";
import { fmtTime, semitones, speedRate, toneFilter, toneLabel } from "@/lib/play/deckmap";
import "./records.css";

// Dots on four concentric rings (angle from the top, clockwise), nudged by a fixed hash so the rows read as hand-placed beats.
const RINGS = [{ r: 39, n: 22 }, { r: 32, n: 17 }, { r: 25, n: 13 }, { r: 18, n: 8 }];
const DOTS = RINGS.flatMap(({ r, n }, k) => Array.from({ length: n }, (_, i) => {
  const h = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
  return { r, th: ((i + (h - Math.floor(h) - 0.5) * 0.35) / n) * 360 + k * 17 };
}));
const LAYERS: [Layer, string][] = [["orig", "Original"], ["lofi", "Lo-fi"], ["rev", "Reverse"]];
const SEEK_FROM = 0.9; // the outer 10% of the disc's radius is the seek ring

type Song = { id: string; title: string; artist: string | null; url: string };

/** The Play deck: the owner's record crate (uploaded on /admin/music, read from /api/songs) as a spinning disc wired to a scope screen, with Sound (filter sweep), Speed (rate, pitch follows),
 *  Delay (echo) knobs, a Volume slider and layer switches. Audio lives in ./deck.ts; this component is the instrument's face. */
export default function Records() {
  const { toast } = useSite();
  const [on, setOn] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [track, setTrack] = useState(0);
  const [p, setP] = useState<DeckParams>(DEFAULTS);
  const deck = useRef<Deck | null>(null);
  const spin = useRef<HTMLDivElement>(null);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const ring = useRef<SVGCircleElement>(null);
  const handle = useRef<SVGGElement>(null);
  const seekEl = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const scope = useRef<Scope | null>(null);
  const seeking = useRef(false);

  // One deck per mount; destroy() stops the audio and closes the context when the tab closes.
  useEffect(() => {
    const sc = createScope(canvas.current!);
    scope.current = sc;
    const hit: boolean[] = [];
    let sec = -1;
    const d = new Deck({
      frame: (f) => {
        if (spin.current) spin.current.style.transform = `rotate(${f.angle.toFixed(2)}deg)`;
        // a dot lights as it passes under the fixed pointer at the top, then fades
        DOTS.forEach((dt, i) => {
          const a = ((dt.th + f.angle + 180) % 360 + 360) % 360 - 180, h = Math.abs(a) < 4.5;
          if (h !== !!hit[i]) { hit[i] = h; dots.current[i]?.toggleAttribute("data-hit", h); }
        });
        const fr = f.pos / f.dur;
        ring.current?.style.setProperty("stroke-dasharray", `${fr.toFixed(4)} 1`);
        handle.current?.setAttribute("transform", `rotate(${(fr * 360).toFixed(2)})`);
        if (Math.floor(f.pos) * 1e4 + Math.floor(f.dur) !== sec) { // a new second, or a new track's length
          sec = Math.floor(f.pos) * 1e4 + Math.floor(f.dur);
          if (clock.current) clock.current.textContent = `${fmtTime(f.pos)} / ${fmtTime(f.dur)}`;
          seekEl.current?.setAttribute("aria-valuenow", String(Math.round(fr * 100)));
          seekEl.current?.setAttribute("aria-valuetext", `${fmtTime(f.pos)} of ${fmtTime(f.dur)}`);
        }
        return sc.draw(f.analyser);
      },
      state: setOn,
      fail: () => toast("No record could load here. The deck still spins."),
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    deck.current = d;
    fetch("/api/songs").then((r) => r.json()).then((list: Song[]) => {
      if (!Array.isArray(list) || !deck.current) return;
      setSongs(list);
      if (list[0]) void d.setTrack(list[0].url);
    }).catch(() => { /* no crate: the deck spins silently */ });
    d.kick(); // paint the idle screen once
    const ro = new ResizeObserver(() => { sc.resize(); d.kick(); });
    ro.observe(canvas.current!);
    return () => { ro.disconnect(); d.destroy(); deck.current = null; scope.current = null; };
  }, [toast]);

  /** Updates one knob or slider: React state for the readouts, the deck for the sound. */
  const set = (k: "sound" | "speed" | "delay" | "volume") => (v: number) => { setP((q) => ({ ...q, [k]: v })); deck.current?.set(k, v); };
  const flip = (l: Layer) => { const v = !p.layers[l]; setP((q) => ({ ...q, layers: { ...q.layers, [l]: v } })); deck.current?.setLayer(l, v); };

  /** Seeks to the pointer's angle around the disc (0 at the top, clockwise), when it is on the outer ring. */
  const seekAt = (e: React.PointerEvent, start: boolean) => {
    const r = seekEl.current!.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    if (start && Math.hypot(dx, dy) < (r.width / 2) * SEEK_FROM) return;
    if (start) { seeking.current = true; seekEl.current!.setPointerCapture(e.pointerId); }
    if (seeking.current) deck.current?.seek((((Math.atan2(dx, -dy) / (2 * Math.PI)) % 1) + 1) % 1);
  };

  const rate = speedRate(p.speed), st = semitones(rate);
  const lp = toneFilter(p.sound).lp, hp = toneFilter(p.sound).hp;
  const soundText = lp < 20000 ? `Low-pass ${lp >= 1000 ? (lp / 1000).toFixed(1) + " kilohertz" : Math.round(lp) + " hertz"}` : hp > 20 ? `High-pass ${hp >= 1000 ? (hp / 1000).toFixed(1) + " kilohertz" : Math.round(hp) + " hertz"}` : "Flat";

  return (
    <div className={`deck${on ? " is-on" : ""}`} id="records">
      <div className="dk-grid">
        <div className="dk-disc">
          <div className="dk-spin" ref={spin} aria-hidden="true">
            <svg viewBox="-50 -50 100 100">
              <circle className="dk-vinyl" r="46" />
              {RINGS.map(({ r }) => <circle key={r} className="dk-groove" r={r} />)}
              {DOTS.map((d, i) => <circle key={i} ref={(n) => { dots.current[i] = n; }} className="dk-dot" cx={d.r * Math.sin((d.th * Math.PI) / 180)} cy={-d.r * Math.cos((d.th * Math.PI) / 180)} r="1.25" />)}
            </svg>
          </div>
          <svg className="dk-prog" viewBox="-50 -50 100 100" aria-hidden="true">
            <circle className="dk-plate" r="48.6" />
            <circle ref={ring} className="dk-done" r="48.6" pathLength={1} strokeDasharray="0 1" transform="rotate(-90)" />
            <g ref={handle}><rect className="dk-pointer" x="-1.6" y="-50" width="3.2" height="7" rx="1.6" /></g>
          </svg>
          <div
            ref={seekEl} className="dk-seek" role="slider" tabIndex={0} aria-label="Position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0} aria-valuetext="0:00"
            onPointerDown={(e) => seekAt(e, true)}
            onPointerMove={(e) => seekAt(e, false)}
            onPointerUp={() => { seeking.current = false; }}
            onPointerCancel={() => { seeking.current = false; }}
            onKeyDown={(e) => {
              const d = ({ ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 } as Record<string, number>)[e.key];
              if (d === undefined) return;
              e.preventDefault();
              deck.current?.seekBy(d);
            }}
          />
          <button className="dk-play" type="button" onClick={() => deck.current?.toggle()}>
            <Ic name={on ? "pause" : "play"} className="ic" />
            <span>{on ? "Pause" : "Play"}</span>
          </button>
        </div>

        <div className="dk-rack">
          <div className="dk-top">
            <div className="dk-bezel">
              <div className="dk-screen">
                <canvas ref={canvas} aria-hidden="true" />
                <span className="dk-tone" aria-hidden="true">Sound {toneLabel(p.sound)}</span>
                <div className="dk-read" aria-hidden="true">
                  <span>{rate.toFixed(2)}x {st >= 0 ? "+" : "−"}{Math.abs(st).toFixed(1)}st</span>
                  <span ref={clock}>0:00 / 1:12</span>
                  <span>Delay {Math.round(p.delay * 100)}</span>
                </div>
              </div>
            </div>
            <ul className="dk-layers" aria-label="Layers">
              {LAYERS.map(([l, name], i) => (
                <li key={l}>
                  <button type="button" role="switch" aria-checked={p.layers[l]} onClick={() => flip(l)}>
                    <i className="dk-sw" aria-hidden="true" /><span>{i + 1}. {name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="dk-knobs">
            <Knob label="Sound" value={p.sound} onChange={set("sound")} bipolar text={soundText} />
            <Knob label="Speed" value={p.speed} onChange={set("speed")} bipolar text={`${rate.toFixed(2)} times speed, ${st >= 0 ? "up" : "down"} ${Math.abs(st).toFixed(1)} semitones`} />
            <Knob label="Delay" value={p.delay} onChange={set("delay")} def={0} text={p.delay === 0 ? "Off" : `${Math.round(p.delay * 100)} percent`} />
          </div>
          <label className="dk-vol" style={{ ["--v" as string]: `${p.volume * 100}%` }}>
            <input type="range" min={0} max={1} step={0.01} value={p.volume} aria-label="Volume" onChange={(e) => set("volume")(+e.target.value)} />
            <span aria-hidden="true">Volume</span>
          </label>
          {songs.length > 1 && <div className="dk-crate" role="radiogroup" aria-label="Record">
            {songs.map((t, i) => (
              <button key={t.id} type="button" role="radio" aria-checked={track === i} onClick={() => { setTrack(i); void deck.current?.setTrack(t.url); }}>
                <i className="dk-sleeve" aria-hidden="true"><i /></i>
                <span><b>{t.title}</b>{t.artist && <small>{t.artist}</small>}</span>
              </button>
            ))}
          </div>}
          <p className="dk-hint">{songs[track] ? `${songs[track].title}${songs[track].artist ? `, ${songs[track].artist}` : ""}. ` : ""}Drag a knob up or down, scroll over it or use the arrow keys. Double-click resets.</p>
        </div>
      </div>
    </div>
  );
}
