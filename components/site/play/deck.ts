/** The Play deck's audio engine: the picked track (TRACKS) through a small Web Audio graph (layers, tone filter, echo, volume, analyser)
 *  plus the disc's spin physics. DOM-free; the Records component supplies the paint hook. */
import { clamp01, delayParams, speedRate, toneFilter, volumeGain } from "@/lib/play/deckmap";

const BASE_DEG = 120; // disc degrees per second at 1x
/** The crate. The owner supplies the audio files in public/v7/music/. */
export const TRACKS = [
  { title: "Adventure of a Lifetime", artist: "Coldplay", src: "/v7/music/adventure-of-a-lifetime.mp3" },
  { title: "What You Know", artist: "Two Door Cinema Club", src: "/v7/music/what-you-know.mp3" },
];
const ECHO_S = 0.34; // fixed echo time; the Delay knob sets how much returns

export type Layer = "orig" | "lofi" | "rev";
export type DeckParams = { sound: number; speed: number; delay: number; volume: number; layers: Record<Layer, boolean> };
export const DEFAULTS: DeckParams = { sound: 0.5, speed: 0.5, delay: 0, volume: 0.8, layers: { orig: true, lofi: false, rev: false } };

export type DeckFrame = { angle: number; pos: number; dur: number; rate: number; analyser: AnalyserNode | null };
export type DeckHooks = {
  /** Every animation frame while the deck is alive; return true while the screen still has signal to show (keeps the loop running through echo tails). */
  frame: (f: DeckFrame) => boolean;
  /** Playing / paused changed. */
  state: (on: boolean) => void;
  /** The audio could not load; the deck keeps spinning silently. */
  fail: () => void;
};

type AC = typeof AudioContext;
type Graph = {
  gOrig: GainNode; gLofi: GainNode; gRev: GainNode; fwdIn: GainNode; revIn: GainNode;
  lp: BiquadFilterNode; hp: BiquadFilterNode; wet: GainNode; fb: GainNode; vol: GainNode; analyser: AnalyserNode;
};

export class Deck {
  on = false;
  params: DeckParams = { ...DEFAULTS, layers: { ...DEFAULTS.layers } };
  private ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private buf: AudioBuffer | null = null;
  private rev: AudioBuffer | null = null;
  private srcs: AudioBufferSourceNode[] = [];
  private fades: GainNode[] = [];
  private loading: Promise<void> | null = null;
  private src = TRACKS[0].src;
  private angle = 0;
  private vel = 0;
  private pos = 0;
  private raf = 0;
  private last = 0;
  private dead = false;

  constructor(private hooks: DeckHooks, private reduce: boolean) {}

  private get dur() { return this.buf ? this.buf.duration : 72; }
  private wrapT(t: number) { const d = this.dur; return ((t % d) + d) % d; }
  /** The speed the audio is really running at right now (0 once stopped). */
  private get rate() { return this.srcs[0] ? this.srcs[0].playbackRate.value : this.on ? speedRate(this.params.speed) : 0; }

  /** Builds the graph: both sources feed layer gains, then tone (low-pass + high-pass), an echo with damped feedback, a compressor, and the volume. The analyser listens before the volume so the scope does not shrink with it. */
  private build(ctx: AudioContext): Graph {
    const gain = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
    const filter = (type: BiquadFilterType, f: number, q = 0.707) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
    const bus = gain(), fwdIn = gain(), revIn = gain(), gOrig = gain(0.8), gLofi = gain(0.75), gRev = gain(0.55);
    const lp = filter("lowpass", 20000), hp = filter("highpass", 20), mix = gain();
    // lo-fi: a gramophone's narrow band plus a little saturation
    const shaper = ctx.createWaveShaper();
    shaper.curve = Float32Array.from({ length: 256 }, (_, i) => Math.tanh(((i / 255) * 2 - 1) * 2.5));
    fwdIn.connect(gOrig).connect(bus);
    fwdIn.connect(filter("highpass", 380)).connect(filter("lowpass", 3000)).connect(shaper).connect(gLofi).connect(bus);
    revIn.connect(filter("lowpass", 1800)).connect(gRev).connect(bus);
    bus.connect(lp).connect(hp).connect(mix);
    const delay = ctx.createDelay(1), wet = gain(0), fb = gain(0);
    delay.delayTime.value = ECHO_S;
    hp.connect(delay).connect(filter("lowpass", 3500)).connect(wet).connect(mix);
    delay.connect(fb).connect(delay);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.78;
    const vol = gain();
    mix.connect(comp);
    comp.connect(analyser);
    comp.connect(vol).connect(ctx.destination);
    return { gOrig, gLofi, gRev, fwdIn, revIn, lp, hp, wet, fb, vol, analyser };
  }

  /** Pushes every stored param onto the graph (smoothed, so knobs never click). */
  private apply() {
    const ctx = this.ctx, g = this.g, p = this.params;
    if (!ctx || !g) return;
    const t = ctx.currentTime, ease = (a: AudioParam, v: number, k = 0.03) => a.setTargetAtTime(v, t, k);
    const tone = toneFilter(p.sound), echo = delayParams(p.delay);
    ease(g.lp.frequency, tone.lp); ease(g.hp.frequency, tone.hp);
    ease(g.wet.gain, echo.wet); ease(g.fb.gain, echo.feedback);
    ease(g.vol.gain, volumeGain(p.volume), 0.02);
    ease(g.gOrig.gain, p.layers.orig ? 0.8 : 0, 0.04); ease(g.gLofi.gain, p.layers.lofi ? 0.75 : 0, 0.04); ease(g.gRev.gain, p.layers.rev ? 0.55 : 0, 0.04);
    const r = speedRate(p.speed);
    if (this.on) for (const s of this.srcs) ease(s.playbackRate, r, 0.05);
  }

  /** Stores one knob/slider/layer value (0..1) and applies it when the graph exists; before the first play it just waits. */
  set(k: "sound" | "speed" | "delay" | "volume", v: number) { this.params[k] = clamp01(v); this.apply(); this.kick(); }
  setLayer(l: Layer, on: boolean) { this.params.layers[l] = on; this.apply(); }

  /** Creates the AudioContext once (only ever from a user gesture) and decodes the current track plus a reversed copy. */
  private load(): Promise<void> {
    if (this.loading) return this.loading;
    const src = this.src;
    this.loading = (async () => {
      if (!this.ctx) {
        const Ctor: AC = window.AudioContext || (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
        this.ctx = new Ctor();
      }
      const ctx = this.ctx;
      const buf = await ctx.decodeAudioData(await (await fetch(src)).arrayBuffer());
      if (this.dead || src !== this.src) return; // another track was picked while this one decoded
      const n = buf.length, rv = ctx.createBuffer(1, n, buf.sampleRate), o = rv.getChannelData(0);
      const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
      for (let i = 0; i < n; i++) o[i] = (L[n - 1 - i] + R[n - 1 - i]) * 0.5;
      this.buf = buf; this.rev = rv;
      this.g ??= this.build(ctx);
      this.apply();
    })();
    return this.loading;
  }

  /** Swaps to TRACKS[i] from the top, keeping play/pause; a paused deck decodes it on the next play. */
  async setTrack(i: number) {
    const src = TRACKS[i]?.src;
    if (!src || src === this.src) return;
    this.stopMain(false);
    this.src = src; this.buf = null; this.rev = null; this.loading = null; this.pos = 0;
    this.kick();
    if (!this.on) return;
    const ok = await this.ready();
    if (this.dead || src !== this.src || !this.on) return;
    if (ok) this.startMain(this.vel / BASE_DEG); else this.hooks.fail();
  }

  /** Awaits load and resumes a suspended context; false when audio is unavailable. */
  private async ready(): Promise<boolean> {
    try {
      await this.load();
      if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
      return !this.dead && !!this.buf;
    } catch { this.loading = null; return false; }
  }

  /** Starts the looping track (and its mirrored reverse twin, which stays in sync because both loop at the same speed) at the playhead, easing up from `fromRate`. */
  private startMain(fromRate: number) {
    const ctx = this.ctx, g = this.g;
    if (!ctx || !g || !this.buf || !this.rev) return;
    this.stopMain(false);
    const t = ctx.currentTime, to = speedRate(this.params.speed);
    for (const [buffer, into, offset] of [[this.buf, g.fwdIn, this.wrapT(this.pos)], [this.rev, g.revIn, this.wrapT(this.dur - this.pos)]] as const) {
      const s = ctx.createBufferSource(), f = ctx.createGain();
      s.buffer = buffer; s.loop = true;
      s.playbackRate.setValueAtTime(Math.max(0.01, fromRate), t);
      s.playbackRate.linearRampToValueAtTime(to, t + 0.55);
      s.connect(f).connect(into);
      s.start(t, offset);
      this.srcs.push(s); this.fades.push(f);
    }
  }

  /** Stops the sources: a slow spin-down (pitch falls with the disc) when `spinDown`, else a near-instant cut. */
  private stopMain(spinDown: boolean) {
    const ctx = this.ctx, srcs = this.srcs, fades = this.fades;
    this.srcs = []; this.fades = [];
    if (!ctx) return;
    const t = ctx.currentTime;
    srcs.forEach((s, i) => {
      try {
        if (spinDown) {
          s.playbackRate.cancelScheduledValues(t);
          s.playbackRate.setValueAtTime(s.playbackRate.value, t);
          s.playbackRate.exponentialRampToValueAtTime(0.02, t + 0.9);
          fades[i].gain.setTargetAtTime(0, t + 0.6, 0.12);
          s.stop(t + 1.1);
        } else {
          fades[i].gain.setTargetAtTime(0, t, 0.008);
          s.stop(t + 0.05);
        }
      } catch { /* already stopped */ }
    });
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    const spinning = this.srcs.length > 0 || (this.on && !this.buf);
    const target = spinning && this.on ? BASE_DEG * speedRate(this.params.speed) : 0;
    // the disc has inertia: it eases to speed and coasts to a stop (reduced motion: no spin at all)
    if (this.reduce) this.vel = 0;
    else {
      this.vel += (target - this.vel) * Math.min(1, dt * (this.on ? 2.2 : 1.3));
      if (!this.on && Math.abs(this.vel) < 2) this.vel = 0;
      this.angle += this.vel * dt;
    }
    if (spinning) this.pos = this.wrapT(this.pos + dt * this.rate);
    const busy = this.hooks.frame({ angle: this.angle % 360, pos: this.pos, dur: this.dur, rate: this.rate, analyser: this.g?.analyser ?? null });
    if (this.on || this.vel !== 0 || busy) this.raf = requestAnimationFrame(this.frame);
    else this.last = 0;
  };

  /** Starts the frame loop if idle (also paints one frame after a seek or knob move while paused). */
  kick() { if (!this.raf && !this.dead) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }

  /** Play or pause (a click is the user gesture that creates the AudioContext). */
  async toggle() {
    const ok = await this.ready();
    if (this.dead) return;
    if (!ok && !this.buf) this.hooks.fail();
    this.on = !this.on;
    this.hooks.state(this.on);
    if (this.buf) { if (this.on) this.startMain(this.vel / BASE_DEG); else this.stopMain(true); }
    this.kick();
  }

  /** Jumps the playhead to a fraction (0..1) of the track. */
  seek(frac: number) {
    this.pos = clamp01(frac) * this.dur;
    if (this.on && this.buf) this.startMain(this.rate || 1);
    this.kick();
  }

  /** Moves the playhead by `sec` seconds (wrapping), for the keyboard. */
  seekBy(sec: number) { this.seek(this.wrapT(this.pos + sec) / this.dur); }

  /** Stops everything and releases the AudioContext. */
  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    for (const s of this.srcs) { try { s.stop(); } catch { /* not started */ } }
    this.srcs = [];
    this.g?.vol.disconnect();
    this.ctx?.close().catch(() => {});
    this.ctx = null; this.g = null;
  }
}
