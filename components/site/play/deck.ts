/** The scratchable record deck's engine (ported from the v7 mockup's `rec`): platter physics plus Web Audio. DOM-free; the Records component supplies paint hooks. */
const DEG_PER_SEC = 78 * 6; // a 78 rpm record
const SEC_PER_DEG = 1 / DEG_PER_SEC;
const SRC = "/v7/chili-pepper.mp3";

export type DeckHooks = {
  /** Called every frame with the platter angle in degrees. */
  spin: (angle: number) => void;
  /** Called at about 4 Hz (and on seeks) with the playhead and track length in seconds. */
  time: (pos: number, dur: number) => void;
  /** Play/scratch state changed. */
  state: (on: boolean, scratching: boolean) => void;
  /** The audio could not load; the deck keeps spinning silently. */
  fail: () => void;
};

type AC = typeof AudioContext;

export class Deck {
  on = false;
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private buf: AudioBuffer | null = null;
  private rev: AudioBuffer | null = null;
  private src: AudioBufferSourceNode | null = null;
  private srcGain: GainNode | null = null;
  private loading: Promise<void> | null = null;
  private drag = false;
  private angle = 0;
  private vel = 0;
  private pos = 0;
  private lastA = 0;
  private moves: [number, number][] = [];
  private grainT = 0;
  private raf = 0;
  private last = 0;
  private textT = 0;
  private dead = false;

  constructor(private hooks: DeckHooks, private reduce: boolean) {}

  private get dur() { return this.buf ? this.buf.duration : 72; }
  private wrapT(t: number) { const d = this.dur; return ((t % d) + d) % d; }

  /** Creates the AudioContext (only ever called from a user gesture) and decodes the track plus a reversed copy for backspin. */
  private load(): Promise<void> {
    if (this.loading) return this.loading;
    this.loading = (async () => {
      const Ctor: AC = window.AudioContext || (window as unknown as { webkitAudioContext: AC }).webkitAudioContext;
      const ctx = new Ctor();
      this.ctx = ctx;
      try {
        const out = ctx.createGain();
        out.gain.value = 0.9;
        out.connect(ctx.destination);
        this.out = out;
        const buf = await ctx.decodeAudioData(await (await fetch(SRC)).arrayBuffer());
        if (this.dead) return;
        const n = buf.length, rv = ctx.createBuffer(1, n, buf.sampleRate), o = rv.getChannelData(0);
        const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
        for (let i = 0; i < n; i++) o[i] = (L[n - 1 - i] + R[n - 1 - i]) * 0.5;
        this.buf = buf;
        this.rev = rv;
        this.hooks.time(this.pos, this.dur);
      } catch (e) {
        this.ctx = null; this.out = null;
        ctx.close().catch(() => {});
        throw e;
      }
    })();
    return this.loading;
  }

  /** Awaits load and resumes a suspended context; false when audio is unavailable. */
  private async ready(): Promise<boolean> {
    try {
      await this.load();
      if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
      return !this.dead && !!this.buf;
    } catch { this.loading = null; return false; }
  }

  /** Starts the looping track at the playhead, easing the rate up from `fromRate` to 1. */
  private startMain(fromRate: number) {
    const ctx = this.ctx, out = this.out;
    if (!ctx || !out || !this.buf) return;
    this.stopMain(false);
    const t = ctx.currentTime, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = this.buf; s.loop = true; s.connect(g); g.connect(out);
    s.playbackRate.setValueAtTime(Math.max(0.01, fromRate), t);
    s.playbackRate.linearRampToValueAtTime(1, t + 0.55);
    s.start(t, this.wrapT(this.pos));
    this.src = s; this.srcGain = g;
  }

  /** Stops the main track: a slow spin-down when `spinDown`, else a near-instant cut. */
  private stopMain(spinDown: boolean) {
    const s = this.src, ctx = this.ctx, g = this.srcGain;
    if (!s || !ctx || !g) return;
    this.src = null;
    const t = ctx.currentTime;
    try {
      if (spinDown) {
        s.playbackRate.cancelScheduledValues(t);
        s.playbackRate.setValueAtTime(s.playbackRate.value, t);
        s.playbackRate.exponentialRampToValueAtTime(0.02, t + 0.9);
        g.gain.setTargetAtTime(0, t + 0.6, 0.12);
        s.stop(t + 1.1);
      } else {
        g.gain.setTargetAtTime(0, t, 0.008);
        s.stop(t + 0.05);
      }
    } catch { /* already stopped */ }
  }

  /** One short scratch grain at the playhead; rate sign picks forward or reversed audio. */
  private grain(rate: number) {
    const ctx = this.ctx, out = this.out;
    if (!ctx || !out || !this.buf) return;
    const t = ctx.currentTime, fwd = rate >= 0, s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = fwd ? this.buf : this.rev;
    s.playbackRate.value = Math.min(3.5, Math.max(0.12, Math.abs(rate)));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.95, t + 0.005);
    g.gain.setTargetAtTime(0, t + 0.045, 0.014);
    s.connect(g); g.connect(out);
    // the reversed buffer is read from the mirrored position
    s.start(t, fwd ? this.wrapT(this.pos) : this.wrapT(this.dur - this.pos), 0.12);
  }

  /** Pushes the platter angle every frame, and the clock text at ~4 Hz (or when forced). */
  private paint(force: boolean) {
    this.hooks.spin(this.angle % 360);
    const now = performance.now();
    if (force || now - this.textT > 250) { this.textT = now; this.hooks.time(this.pos, this.dur); }
  }

  private frame = (now: number) => {
    this.raf = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.drag) {
      if (this.reduce) {
        // reduced motion: no spinning platter, but the playhead still advances
        this.vel = 0;
        if (this.on) this.pos = this.wrapT(this.pos + dt);
      } else {
        const target = this.on ? DEG_PER_SEC : 0;
        this.vel += (target - this.vel) * Math.min(1, dt * (this.on ? 2.2 : 1.3));
        if (!this.on && Math.abs(this.vel) < 2) this.vel = 0;
        this.angle += this.vel * dt;
        this.pos = this.wrapT(this.pos + this.vel * dt * SEC_PER_DEG);
      }
    }
    this.paint(false);
    if (this.on || this.vel !== 0 || this.drag) this.raf = requestAnimationFrame(this.frame);
    else { this.last = 0; this.paint(true); }
  };

  private kick() { if (!this.raf && !this.dead) { this.last = 0; this.raf = requestAnimationFrame(this.frame); } }

  /** Play or pause (a click is the user gesture that creates the AudioContext). */
  async toggle() {
    const ok = await this.ready();
    if (this.dead) return;
    if (!ok && !this.buf) this.hooks.fail();
    this.on = !this.on;
    this.hooks.state(this.on, this.drag);
    if (this.buf) { if (this.on) this.startMain(this.vel / DEG_PER_SEC); else this.stopMain(true); }
    this.kick();
  }

  /** Grabs the platter at pointer angle `a` (degrees): the main track cuts so scratching is audible alone. */
  grab(a: number) {
    if (this.drag) return;
    this.drag = true; this.vel = 0; this.lastA = a; this.moves = [[performance.now(), 0]];
    this.hooks.state(this.on, true);
    this.ready().then(() => { if (this.drag) this.stopMain(false); });
    if (this.src) this.stopMain(false);
    this.kick();
  }

  /** Drags to pointer angle `a`; velocity from the last few moves sets the grain rate. */
  move(a: number) {
    if (!this.drag) return;
    const now = performance.now();
    let da = a - this.lastA;
    if (da > 180) da -= 360;
    if (da < -180) da += 360;
    this.angle += da; this.pos = this.wrapT(this.pos + da * SEC_PER_DEG); this.lastA = a;
    this.moves.push([now, da]);
    if (this.moves.length > 5) this.moves.shift();
    const span = Math.max(8, now - this.moves[0][0]) / 1000;
    this.vel = this.moves.slice(1).reduce((s, m) => s + m[1], 0) / span;
    if (now - this.grainT > 26 && Math.abs(da) > 0.25) { this.grainT = now; this.grain(this.vel / DEG_PER_SEC); }
  }

  /** Lets go; if playing, the track resumes at the release speed and eases back to 1x. */
  release() {
    if (!this.drag) return;
    this.drag = false;
    this.hooks.state(this.on, false);
    if (this.on && this.buf) this.startMain(Math.min(1, Math.abs(this.vel) / DEG_PER_SEC));
    this.kick();
  }

  /** Arrow-key scratch: nudges the platter 36 degrees. */
  async nudge(dir: 1 | -1) {
    await this.ready();
    if (this.dead) return;
    this.angle += dir * 36; this.pos = this.wrapT(this.pos + dir * 36 * SEC_PER_DEG);
    this.grain(dir * 1.3);
    this.paint(true);
  }

  /** Jumps the playhead to a fraction (0..1) of the track. */
  seek(frac: number) {
    this.pos = Math.max(0, Math.min(1, frac)) * this.dur;
    if (this.on && this.buf) this.startMain(1);
    this.paint(true);
  }

  /** Stops everything and releases the AudioContext. */
  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    try { this.src?.stop(); } catch { /* not started */ }
    this.src = null;
    this.out?.disconnect();
    this.ctx?.close().catch(() => {});
    this.ctx = null; this.out = null;
  }
}
