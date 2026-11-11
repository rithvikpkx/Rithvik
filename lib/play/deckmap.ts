/** Pure knob-to-audio mappings for the Play deck: every control is a 0..1 value, and these turn it into AudioParam numbers. */

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Snaps a value to `centre` when it is within `width` of it: the knob's detent. */
export const snap = (v: number, centre = 0.5, width = 0.025) => (Math.abs(v - centre) <= width ? centre : v);

/** Speed knob to playbackRate: exponential so the dial feels even in pitch, exactly 1 at the middle detent (0.66x to 1.52x). */
export const speedRate = (v: number) => 2 ** ((clamp01(v) - 0.5) * 1.2);

/** Pitch shift in semitones that a playback rate causes (a deck's pitch follows its speed). */
export const semitones = (rate: number) => 12 * Math.log2(rate);

/** Sound knob to a DJ-style filter pair: left of centre sweeps a low-pass down (20 kHz to 300 Hz), right of centre sweeps a high-pass up (20 Hz to 3 kHz), centre is flat. */
export function toneFilter(v: number): { lp: number; hp: number } {
  const x = clamp01(v);
  const lp = x >= 0.5 ? 20000 : 300 * (20000 / 300) ** (x / 0.5);
  const hp = x <= 0.5 ? 20 : 20 * (3000 / 20) ** ((x - 0.5) / 0.5);
  return { lp, hp };
}

/** Delay knob to the echo's wet level and feedback; zero means fully dry, and feedback is capped so the tail always decays. */
export function delayParams(v: number): { wet: number; feedback: number } {
  const x = clamp01(v);
  return { wet: x * 0.85, feedback: x === 0 ? 0 : Math.min(0.7, 0.2 + 0.55 * x) };
}

/** Volume slider to a gain: squared so the lower half of the travel is usable. */
export const volumeGain = (v: number) => clamp01(v) ** 2;

/** Short readout text for the screen: the tone knob as "FLAT", "LP 1.2k" or "HP 800". */
export function toneLabel(v: number): string {
  const { lp, hp } = toneFilter(v);
  const k = (f: number) => (f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`);
  return lp < 20000 ? `LP ${k(lp)}` : hp > 20 ? `HP ${k(hp)}` : "FLAT";
}

/** m:ss for a number of seconds. */
export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
