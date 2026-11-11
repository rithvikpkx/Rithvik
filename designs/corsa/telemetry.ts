// Corsa's telemetry: pure maths behind the turntable (inertia, framing) and the instruments it drives (rpm, gear,
// rev lights, lap timing). No DOM, no three.js, so it runs under node:test.

export const IDLE_RPM = 1100;
export const MAX_RPM = 9500; // the SP3's V12 redlines at 9,500
export const REDLINE = 8500; // the gauge's red arc starts here
export const AUTO_SPIN = 0.16; // rad/s: the turntable's resting speed (one lap ≈ 39 s)

/** Engine speed for a turntable angular speed (rad/s): idle at rest, climbing toward the limiter as the visitor spins it. */
export function rpmFor(spin: number): number {
  const s = Math.abs(spin);
  return IDLE_RPM + (MAX_RPM - IDLE_RPM) * (1 - Math.exp(-Math.max(0, s - AUTO_SPIN) / 2.2));
}

/** The gear the seven-speed box would hold at this spin (1 on the turntable, 7 flat out). */
export function gearFor(spin: number): number {
  const s = Math.abs(spin);
  return Math.min(7, 1 + Math.floor(Math.max(0, s - AUTO_SPIN) / 0.9));
}

/** rpm as 0..1 of the gauge's sweep. */
export const rpmUnit = (rpm: number) => Math.min(1, Math.max(0, rpm / MAX_RPM));

/** Lit LEDs of an n-light rev strip for this rpm: the strip starts at 30% of max and is full at the redline. */
export function revLights(rpm: number, n = 15): number {
  const k = (rpm - MAX_RPM * 0.3) / (REDLINE - MAX_RPM * 0.3);
  return Math.max(0, Math.min(n, Math.round(k * n)));
}

/** One step of the turntable's yaw velocity: free spin decays toward the resting speed (in the direction it was going),
 *  with a time constant of `tau` seconds. */
export function coast(vel: number, dt: number, tau = 1.4): number {
  const target = vel < 0 ? -AUTO_SPIN : AUTO_SPIN;
  return target + (vel - target) * Math.exp(-dt / tau);
}

/** Camera distance that makes a car `len` long fill `frac` of the view's width (vertical fov in degrees). */
export function fitDistance(len: number, fovDeg: number, aspect: number, frac: number): number {
  const halfH = Math.tan((fovDeg * Math.PI) / 360);
  return len / (frac * 2 * halfH * Math.max(0.2, aspect));
}

/** View offset (three's setViewOffset x, y) that moves the frame's centre to (cx, cy), fractions of the view. */
export const viewOffset = (w: number, h: number, cx: number, cy: number): [number, number] => [(0.5 - cx) * w, (0.5 - cy) * h];

/** "1:12.408" from seconds. */
export function lapClock(s: number): string {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, "0")}`;
}

/** "−0.214" / "+1.030" (a real minus sign) from a delta in seconds. */
export const deltaText = (d: number) => `${d < 0 ? "−" : "+"}${Math.abs(d).toFixed(3)}`;

export type Lap = { n: number; t: number; best: number; last: number; delta: number; fast: boolean };

/** Lap timing for the turntable: one lap is one full turn of the car (in either direction). Feed it the absolute
 *  yaw travelled and the time; it returns the state, with `delta` against the best lap so far and `fast` when the
 *  lap just completed set a new best. */
export function lapTimer() {
  let start = 0, from = 0, n = 0, best = Infinity, last = 0, delta = 0, fast = false;
  return (travel: number, now: number): Lap => {
    if (travel - from >= Math.PI * 2) {
      const t = now - start;
      delta = Number.isFinite(best) ? t - best : 0;
      fast = t < best;
      if (fast) best = t;
      last = t; n++; start = now; from += Math.PI * 2;
    }
    return { n, t: now - start, best, last, delta, fast };
  };
}
