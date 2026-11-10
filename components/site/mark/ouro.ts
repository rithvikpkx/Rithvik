/** Geometry of the ouroboros mark ("Swallow", brand round 2). Pure, no DOM; one polygon in a -50..50 view box.
 *  A single band runs once round the circle: full width at the head, easing down to a narrow tail whose rounded end
 *  slides back into the head between two rounded lips, held off them by one hairline of negative space (an "S"). */
export type OuroOpts = {
  R: number; // centreline radius
  W: number; // band width at the head
  head: number; // angle of the head's front, degrees (SVG: clockwise from +x)
  hold: number; // degrees behind the head that stay full width before the taper starts
  tip: number; // width of the tail's rounded end
  T: number; // degrees the tail reaches inside the head
  gap: number; // the hairline between the swallowed tail and the lips
  N: number; // links: 1 is the mark, >1 a chain where each link swallows the next (the loader)
  step: number; // sampling step, degrees
};
export type Ouro = { d: string; eye: [number, number, number]; R: number; W: number; head: number };

export const DEFAULTS: OuroOpts = { R: 31, W: 22, head: -45, hold: 60, tip: 6, T: 22, gap: 3.2, N: 1, step: 2 };
/** Optical size for 16-20px (favicon, kind "tiny"): heavier band, wider hairline, shallower swallow so the junction still reads. */
export const SMALL: Partial<OuroOpts> = { R: 29.5, W: 28, hold: 40, tip: 9, T: 12, gap: 5.5 };

/** The loader: three links, each swallowing the next. */
export const CHAIN: Partial<OuroOpts> = { N: 3, W: 20, hold: 20, tip: 5, T: 14 };

type V = [number, number];

/** Outline of the mark (or of an N-link chain) as an absolute M/L/Z path. */
export function ouroPath(o: Partial<OuroOpts> = {}): Ouro {
  const P = { ...DEFAULTS, ...o }, R = P.R;
  const per = 360 / P.N, L = per + P.T, rad = (d: number) => (d * Math.PI) / 180;
  // cosine ease from W to tip: flat at both ends, so neither edge kinks where the taper starts or ends
  const w = (s: number) => (s <= P.hold ? P.W : P.tip + ((P.W - P.tip) * (1 + Math.cos((Math.PI * (s - P.hold)) / (L - P.hold)))) / 2);
  const range = (a: number, b: number) => { const n = Math.max(1, Math.ceil(Math.abs(b - a) / P.step)), out: number[] = []; for (let i = 0; i <= n; i++) out.push(a + ((b - a) * i) / n); return out; };
  const hs = (s: number) => w(per + s) / 2 + P.gap; // socket half-width = the tail it holds, plus the hairline
  const lip = (sign: 1 | -1) => { const a = R + sign * hs(0), b = R + (sign * P.W) / 2; return [(a + b) / 2, Math.abs(b - a) / 2] as const; };
  const [li, liR] = lip(-1), [lo, loR] = lip(1);
  const f = (p: V) => p[0].toFixed(2) + " " + p[1].toFixed(2);
  const link = (k: number) => {
    const h = P.head - k * per; // s grows anticlockwise from the head, so the snake travels clockwise
    const pt = (r: number, s: number): V => [r * Math.cos(rad(h - s)), r * Math.sin(rad(h - s))];
    // half-disc of radius rho centred at (rc, s); phi 0..180 bulges toward larger s, 180..360 toward smaller s
    const cap = (s: number, rc: number, rho: number, from: number, to: number): V[] => {
      const a = rad(h - s), n: V = [Math.cos(a), Math.sin(a)], t: V = [Math.sin(a), -Math.cos(a)];
      return range(from, to).map((phi) => [rc * n[0] + rho * (n[0] * Math.cos(rad(phi)) + t[0] * Math.sin(rad(phi))), rc * n[1] + rho * (n[1] * Math.cos(rad(phi)) + t[1] * Math.sin(rad(phi)))] as V);
    };
    const ring: V[] = [
      ...range(0, L).map((s) => pt(R + w(s) / 2, s)), // outer edge, head to tail
      ...cap(L, R, P.tip / 2, 0, 180), // rounded tail end
      ...range(L, 0).map((s) => pt(R - w(s) / 2, s)), // inner edge back to the head
      ...cap(0, li, liR, 180, 360), // inner lip
      ...range(0, P.T).map((s) => pt(R - hs(s), s)), // socket, inner side
      ...cap(P.T, R, P.tip / 2 + P.gap, 180, 0), // round the swallowed tip
      ...range(P.T, 0).map((s) => pt(R + hs(s), s)), // socket, outer side
      ...cap(0, lo, loR, 180, 360), // outer lip
    ];
    return "M" + ring.map(f).join(" L") + " Z";
  };
  // no eye any more; kept as a zero-radius circle for callers that still punch one (foil, KgShape)
  return { d: Array.from({ length: P.N }, (_, k) => link(k)).join(" "), eye: [0, 0, 0], R, W: P.W, head: P.head };
}
