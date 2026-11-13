// Blueprint's drafting arithmetic: screen pixels as drawing millimetres, cursor coordinates, and the title block each
// sheet (section) carries. Pure, so node:test can check it (drafting.test.ts).

/** CSS pixels per millimetre (96 dpi). */
export const PX_PER_MM = 96 / 25.4;

/** A length in CSS pixels as a drawing dimension in whole millimetres ("612"); never negative. */
export const mm = (px: number) => String(Math.max(0, Math.round(px / PX_PER_MM)));

/** A cursor coordinate as a four-digit drafting readout ("0412"); clamps to 0–9999. */
export const coord = (px: number) => String(Math.min(9999, Math.max(0, Math.round(px)))).padStart(4, "0");

/** A measured box as the dimension pair drawn on a hover ("148 × 62"). */
export const dims = (w: number, h: number) => `${mm(w)} × ${mm(h)}`;

const SCALES = ["1:1", "1:5", "1:2", "1:10", "1:2", "1:1"];

/** The title block a sheet carries: drawing number, scale, revision and "sheet x of y" (index is 0-based). */
export function sheetFor(index: number, total: number) {
  const n = index + 1;
  return {
    dwg: `BP-${String(n).padStart(2, "0")}`,
    scale: SCALES[index % SCALES.length],
    rev: String.fromCharCode(65 + (index % 26)), // A, B, C...: later sheets were revised more often
    sheet: `${n} OF ${total}`,
  };
}
