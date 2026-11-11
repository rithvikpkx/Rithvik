// Clay's pure helper: a deterministic hand-drawn stroke (an ink rule that wavers like a nib), so the server and the
// client draw the same line and each section gets its own.

/** A tiny seeded hash in 0..1 (no Math.random, so SSR and hydration agree). */
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** An SVG path for a wavering horizontal stroke across a w x h box: a smooth quadratic chain through n points whose
 *  height drifts a little, ending with a small upward flick like a pen leaving the paper. */
export function scribble(seed: number, w = 240, h = 24, n = 9): string {
  const mid = h * 0.55, amp = h * 0.18;
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const x = 4 + ((w - 22) * i) / (n - 1);
    pts.push([x, mid + (hash(seed * 13 + i) - 0.5) * 2 * amp]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += `Q${x0.toFixed(1)} ${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)}`;
  }
  const [lx, ly] = pts[n - 1];
  return d + `Q${lx.toFixed(1)} ${ly.toFixed(1)} ${(w - 4).toFixed(1)} ${(h * 0.18).toFixed(1)}`;
}
