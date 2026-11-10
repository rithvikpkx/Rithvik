// Pure helpers behind the shared Experience body (Experience.tsx): the station monogram, the scroll fill of a
// connector, and one step of the spring the education object rides on.

const SKIP = new Set(["the", "of", "at", "and", "for", "a", "an", "in", "on", "@", "&"]);

/** Two-letter monogram for an organisation ("Snowball Lab, Purdue University" → "SL", "Hack The Future" → "HF"). */
export function orgMark(org: string): string {
  const words = org.split(/[\s,\-–—/()]+/).filter((w) => w && !SKIP.has(w.toLowerCase()) && /^[\p{L}\p{N}]/u.test(w));
  if (!words.length) return "·";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** How far a connector has filled (0–1): the share of its height above the reading line (a viewport y). */
export function fillFor(top: number, height: number, line: number): number {
  if (height <= 0) return line >= top ? 1 : 0;
  return Math.min(1, Math.max(0, (line - top) / height));
}

/** One semi-implicit Euler step of a damped spring toward `target`; returns [position, velocity]. */
export function springStep(x: number, v: number, target: number, dt: number, k = 170, c = 12): [number, number] {
  const nv = v + (k * (target - x) - c * v) * dt;
  return [x + nv * dt, nv];
}
