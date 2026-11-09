/** Geometry of the ouroboros mark (ported from the v7 mockup, itself from v5 `ouroPath`). Pure, no DOM. */
export type OuroOpts = {
  R: number; W: number; head: number; mouth: number; mouthDepth: number; taper: number; taperPow: number;
  tipGap: number; eyeBack: number; eyeOff: number; eyeR: number; step: number;
};
export type Ouro = { d: string; eye: [number, number, number]; R: number; W: number; head: number };

const DEFAULTS: OuroOpts = { R: 32, W: 18, head: -64, mouth: 34, mouthDepth: 0.16, taper: 70, taperPow: 0.85, tipGap: 3, eyeBack: 5, eyeOff: 0.2, eyeR: 0.11, step: 3 };

type V = [number, number];

/** Outline of the mark: an even ring, a rounded snout with a wedge mouth, and a tail that tapers into it. */
export function ouroPath(o: Partial<OuroOpts> = {}): Ouro {
  const P = { ...DEFAULTS, ...o };
  const rad = (d: number) => (d * Math.PI) / 180, h = rad(P.head), n: V = [Math.cos(h), Math.sin(h)], t: V = [-Math.sin(h), Math.cos(h)];
  const add = (a: V, b: V, k = 1): V => [a[0] + b[0] * k, a[1] + b[1] * k], c: V = [P.R * n[0], P.R * n[1]], hw = P.W / 2, S = 360 - P.tipGap;
  // eased taper so the inner edge has no kink where the tail starts thinning
  const width = (s: number) => { const x = (S - s) / P.taper; return x >= 1 ? P.W : P.W * Math.pow(1 - (1 - x) * (1 - x), P.taperPow); };
  const pt = (r: number, deg: number): V => [r * Math.cos(rad(deg)), r * Math.sin(rad(deg))];
  const outer: V[] = [], inner: V[] = [];
  for (let s = 0; s <= S; s += P.step) { const w = width(s), a = P.head - s; outer.push(pt(P.R + w / 2, a)); inner.push(pt(P.R - w / 2, a)); }
  const cap = (phi: number): V => add(c, add([n[0] * Math.cos(rad(phi)), n[1] * Math.cos(rad(phi))], t, Math.sin(rad(phi))), hw);
  const capO: V[] = [], capI: V[] = [];
  for (let phi = 90 - P.mouth; phi > 0; phi -= 6) capO.push(cap(phi));
  for (let phi = 180; phi > 90 + P.mouth; phi -= 6) capI.push(cap(phi));
  const f = (p: V) => p[0].toFixed(1) + " " + p[1].toFixed(1);
  const ring = [add(c, t, -P.W * P.mouthDepth), cap(90 - P.mouth), ...capO, ...outer, ...inner.reverse(), ...capI, cap(90 + P.mouth)];
  const e = add(add(c, t, -P.eyeBack), n, P.W * P.eyeOff);
  return { d: "M" + ring.map(f).join(" L") + " Z", eye: [+e[0].toFixed(1), +e[1].toFixed(1), +(P.W * P.eyeR).toFixed(2)], R: P.R, W: P.W, head: P.head };
}
