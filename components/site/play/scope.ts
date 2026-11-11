/** The deck's oscilloscope: a glowing waveform over a log-spaced spectrum, drawn on one small 2D canvas from an AnalyserNode. */
export type Scope = { resize: () => void; draw: (an: AnalyserNode | null) => boolean };

const BARS = 40;

/** Binds a scope to a canvas. `draw` paints one frame and returns true while there is signal worth animating (so the caller can stop its loop once silent). The trace colour is the canvas's CSS `color`. */
export function createScope(canvas: HTMLCanvasElement): Scope {
  const g = canvas.getContext("2d")!;
  const td = new Uint8Array(1024), fq = new Uint8Array(512);
  let W = 0, H = 0, dpr = 1, color = "#9cf", n = 0;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    W = Math.max(1, Math.round(canvas.clientWidth * dpr));
    H = Math.max(1, Math.round(canvas.clientHeight * dpr));
    canvas.width = W; canvas.height = H; // also clears the canvas; the caller repaints
  };

  const draw = (an: AnalyserNode | null) => {
    if (n++ % 40 === 0) color = getComputedStyle(canvas).color || color; // follows a design / palette switch
    td.fill(128); fq.fill(0);
    if (an) { an.getByteTimeDomainData(td); an.getByteFrequencyData(fq); }
    g.clearRect(0, 0, W, H);
    let peak = 0, loud = 0;
    for (let i = 0; i < td.length; i++) peak = Math.max(peak, Math.abs(td[i] - 128));
    // spectrum: log-spaced bars rising from the bottom edge
    g.fillStyle = color;
    g.globalAlpha = 0.2;
    const bw = W / BARS;
    for (let b = 0; b < BARS; b++) {
      const lo = Math.floor(2 * 150 ** (b / BARS)), hi = Math.max(lo + 1, Math.floor(2 * 150 ** ((b + 1) / BARS)));
      let m = 0;
      for (let k = lo; k < hi && k < fq.length; k++) m = Math.max(m, fq[k]);
      loud = Math.max(loud, m);
      const h = (m / 255) * H * 0.62;
      g.fillRect(b * bw + bw * 0.15, H - h, bw * 0.7, h);
    }
    // waveform: three passes, wide and faint to thin and bright, make the glow without a blur filter
    const mid = H * 0.42, amp = H * 0.4, step = 4;
    g.beginPath();
    for (let i = 0, x = 0; i < td.length; i += step, x++) {
      const px = (i / (td.length - 1)) * W, py = mid + Math.max(-1, Math.min(1, ((td[i] - 128) / 128) * 1.6)) * amp;
      if (x) g.lineTo(px, py); else g.moveTo(px, py);
    }
    g.lineJoin = "round"; g.lineCap = "round"; g.strokeStyle = color;
    for (const [w, a] of [[9, 0.1], [4.5, 0.25], [2, 1]] as const) { g.lineWidth = w * dpr; g.globalAlpha = a; g.stroke(); }
    g.globalAlpha = 1;
    return peak > 1.5 || loud > 3;
  };

  resize();
  return { resize, draw };
}
