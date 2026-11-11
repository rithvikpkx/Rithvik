// The pulse clock for the tether: each contact node charges, dims, then shoots one pulse of light to the portrait.
// Pure maths (seconds in, numbers out), so node:test can check the timeline and the DOM code stays dumb.

export const PERIOD = 4; // one full cycle per node
export const CHARGE = 1.3; // glow builds
export const DIM = 0.5; // glow fades to nothing; the pulse launches the instant it is gone
export const LAUNCH = CHARGE + DIM;
export const TRAVEL = 1; // node -> portrait
export const LAND = 0.55; // flash on the portrait ring after arrival
const SLOT = [0, 2, 1, 3]; // firing order, one slot per quarter-period: never together, and not a plain left-to-right sweep

export type Beat = {
  tau: number; // seconds into this node's cycle
  glow: number; // node glow 0..1
  run: number; // eased progress of the pulse along the cable (0 at the node, 1 at the portrait), -1 when none is travelling
  land: number; // 0..1 through the landing flash, -1 when none
};

const smooth = (x: number) => x * x * (3 - 2 * x);

/** Accelerates out of the node and settles a little into the photo (a skewed ease-in-out). */
export function travelEase(u: number): number {
  const v = Math.pow(u, 0.88);
  return v * v * (3 - 2 * v);
}

/** Where node `i` (of 4) is in its cycle at clock `t` seconds. */
export function beat(t: number, i: number): Beat {
  const tau = (((t - (SLOT[i] * PERIOD) / 4) % PERIOD) + PERIOD) % PERIOD;
  const glow = tau < CHARGE ? smooth(tau / CHARGE) : tau < LAUNCH ? Math.pow(1 - (tau - CHARGE) / DIM, 2) : 0;
  const u = (tau - LAUNCH) / TRAVEL, l = (tau - LAUNCH - TRAVEL) / LAND;
  return { tau, glow, run: u >= 0 && u <= 1 ? travelEase(u) : -1, land: l >= 0 && l < 1 ? l : -1 };
}
