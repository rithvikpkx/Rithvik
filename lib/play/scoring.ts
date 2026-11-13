/** Pure scoring and round generation for the Play games (ported from the v7 mockup). `rand` is Math.random-shaped so tests can pin it. */
import type { Game } from "./games.ts";

export const LINES = [
  "const faces = await rekognition.searchFacesByImage(params).promise();",
  "model.fit(X_train, y_train, epochs=30, validation_split=0.2)",
  "for (const row of rows) await upsertEmbedding(row.slug, row.text);",
];

/** Picks a Type Racer line. */
export const pickLine = (rand: number) => LINES[Math.floor(rand * LINES.length)];

/** Words per minute (5 chars = 1 word); the 100ms floor stops an instant first key reading as infinity. */
export const wpm = (chars: number, ms: number) => Math.round(chars / 5 / Math.max(ms / 60000, 1 / 600));

/** Accuracy percent from the running error count. */
export const accuracy = (errs: number, typed: number) => Math.max(0, Math.round(100 * (1 - errs / Math.max(1, typed))));

/** True when this keystroke added a wrong character (deleting never counts as a new error). */
export const addsError = (prev: string, next: string, text: string) =>
  next.length > prev.length && next[next.length - 1] !== text[next.length - 1];

/** Whether `you` beats the baseline (higher wins for `hi` games, lower otherwise). */
export const beats = (g: Pick<Game, "hi" | "base">, you: number) => (g.hi ? you >= g.base : you <= g.base);

/** Whether `a` is a better score than `b` for this game. */
export const isBest = (hi: boolean, a: number, b: number | null) => b === null || (hi ? a > b : a < b);

/** Bar fill fractions (0..1) for you vs the baseline, sharing one scale. */
export const barFractions = (you: number, base: number): [number, number] => {
  const max = Math.max(you, base) * 1.15 || 1;
  return [you / max, base / max];
};

/** Mean of a running sum, rounded to one decimal. */
export const meanOf = (sum: number, n: number) => +(sum / n).toFixed(1);

/** Angle round: the gap between the rays (15-164 degrees) and the first ray's tilt in radians. */
export const angleRound = (r1: number, r2: number) => ({ target: 15 + Math.floor(r1 * 150), base: r2 * 0.6 - 0.1 });

/** Dots round: how many dots flash (18-87). */
export const dotCount = (rand: number) => 18 + Math.floor(rand * 70);

/** Dots error as a percent of the true count. */
export const dotsError = (guess: number, n: number) => (Math.abs(guess - n) / n) * 100;

/** Center the Div error: pixel distance from the box centre. */
export const centerError = (pos: [number, number], w: number, h: number) => Math.hypot(pos[0] - w / 2, pos[1] - h / 2);
