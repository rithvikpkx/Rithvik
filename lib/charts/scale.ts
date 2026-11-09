/** Pure chart math shared by the SVG components: scales, path builders, text alternatives. No "@/" imports and
 *  no DOM, so node:test can load it. Components own the drawing; everything computable lives here. */

export type Series = { name: string; values: (number | null)[] };

/** Round `n` to `d` decimals, trimming float noise (0.30000000000000004 → 0.3). */
export const round = (n: number, d = 2): number => Number(n.toFixed(d));

/** A "nice" axis for [lo, hi]: ticks at 1/2/5 × 10^k steps that cover the data. */
export function niceScale(lo: number, hi: number, count = 4): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] };
  if (lo === hi) { if (lo === 0) hi = 1; else if (lo > 0) lo = 0; else hi = 0; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(round(v, 10));
  return { min: round(min, 10), max: round(max, 10), ticks };
}

/** 1234 → "1.2k", 1_500_000 → "1.5M", 12 → "12", 0.256 → "0.26". Axis ticks and compact readouts. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${round(n / 1e6, 1)}M`;
  if (a >= 1e4) return `${round(n / 1e3, 0)}k`;
  if (a >= 1e3) return `${round(n / 1e3, 1)}k`;
  if (a >= 100) return String(Math.round(n));
  return String(round(n, a >= 10 ? 1 : 2));
}

/** A value with its unit: "12 ms", "40%", "$3". Units that hug the number ("%", "$") are glued on. */
export function withUnit(n: number, unit?: string): string {
  const v = compact(n);
  if (!unit) return v;
  if (unit === "$") return `$${v}`;
  return /^[%°]/.test(unit) ? `${v}${unit}` : `${v} ${unit}`;
}

/** SVG path through points, lifting the pen at nulls (gaps in the data are shown, not bridged). */
export function linePath(pts: ({ x: number; y: number } | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${round(p.x)} ${round(p.y)}`;
    pen = true;
  }
  return d;
}

/** Closed areas under each unbroken run of the line down to `base`. */
export function areaPath(pts: ({ x: number; y: number } | null)[], base: number): string {
  let d = "";
  let run: { x: number; y: number }[] = [];
  const flush = () => {
    if (run.length > 1) d += `M${round(run[0].x)} ${round(base)}${run.map((p) => `L${round(p.x)} ${round(p.y)}`).join("")}L${round(run[run.length - 1].x)} ${round(base)}Z`;
    run = [];
  };
  for (const p of pts) { if (p) run.push(p); else flush(); }
  flush();
  return d;
}

/** A bar from `base` to `y` with a 4px (r) rounded data end and a square baseline end; works for either direction. */
export function barPath(x: number, y: number, w: number, base: number, r = 4): string {
  const h = Math.abs(y - base);
  if (h < 0.5) return "";
  const rr = Math.min(r, w / 2, h);
  const up = y < base;
  const [a, b, c] = [round(x), round(x + w), round(y)];
  const bs = round(base);
  const inner = round(up ? y + rr : y - rr);
  return `M${a} ${bs}V${inner}Q${a} ${c} ${round(x + rr)} ${c}H${round(x + w - rr)}Q${b} ${c} ${b} ${inner}V${bs}Z`;
}

/** Slice angles (radians, from 12 o'clock, clockwise) proportional to positive values. */
export function donutAngles(values: number[]): { a0: number; a1: number; share: number }[] {
  const total = values.reduce((s, v) => s + Math.max(0, v), 0);
  let at = 0;
  return values.map((v) => {
    const share = total > 0 ? Math.max(0, v) / total : 0;
    const a0 = at;
    at += share * Math.PI * 2;
    return { a0, a1: at, share };
  });
}

/** Annular sector path (angles from 12 o'clock). A full circle is split in two sectors, which SVG cannot draw as one arc. */
export function arcPath(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) return arcPath(cx, cy, ro, ri, a0, a0 + Math.PI) + arcPath(cx, cy, ro, ri, a0 + Math.PI, a0 + Math.PI * 2);
  const pt = (r: number, a: number) => `${round(cx + r * Math.sin(a))} ${round(cy - r * Math.cos(a))}`;
  const big = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(ro, a0)}A${ro} ${ro} 0 ${big} 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri} ${ri} 0 ${big} 0 ${pt(ri, a0)}Z`;
}

/** Fractional year for "2024", "2024-05" or "present" (→ `now`); null for anything else. */
export function yearValue(s: string, now: Date): number | null {
  const t = s.trim().toLowerCase();
  if (t === "present" || t === "now") return now.getUTCFullYear() + now.getUTCMonth() / 12;
  const m = /^(\d{4})(?:-(\d{2}))?$/.exec(t);
  if (!m) return null;
  const mo = m[2] ? Number(m[2]) : 1;
  return mo >= 1 && mo <= 12 ? Number(m[1]) + (mo - 1) / 12 : null;
}

/** Percent positions for a timeline's bars on a shared axis, plus year ticks. Items with an unreadable start are skipped. */
export function timelineLayout(items: { start: string; end?: string }[], now: Date): { rows: ({ left: number; width: number } | null)[]; ticks: { year: number; at: number }[] } {
  const spans = items.map((i) => {
    const s = yearValue(i.start, now);
    if (s === null) return null;
    const e = i.end ? yearValue(i.end, now) : s;
    return { s, e: Math.max(s, e ?? s) };
  });
  const ok = spans.filter((x): x is { s: number; e: number } => !!x);
  if (!ok.length) return { rows: spans.map(() => null), ticks: [] };
  const lo = Math.floor(Math.min(...ok.map((x) => x.s)));
  const hi = Math.max(lo + 1, Math.ceil(Math.max(...ok.map((x) => x.e))));
  const span = hi - lo;
  const step = span > 12 ? 5 : span > 6 ? 2 : 1;
  const ticks: { year: number; at: number }[] = [];
  for (let y = lo; y <= hi; y += step) ticks.push({ year: y, at: ((y - lo) / span) * 100 });
  // a bar is at least ~1.2% wide so a one-month role is still a visible mark
  return { rows: spans.map((x) => (x ? { left: ((x.s - lo) / span) * 100, width: Math.max(1.2, ((x.e - x.s) / span) * 100) } : null)), ticks };
}

/** Points on a circle, starting at 12 o'clock. */
export function circleLayout(n: number, cx: number, cy: number, r: number): { x: number; y: number; angle: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / Math.max(1, n)) * Math.PI * 2;
    return { x: round(cx + r * Math.sin(angle)), y: round(cy - r * Math.cos(angle)), angle };
  });
}

/** True when every label y (px) sits at least `gap` from its neighbours, so direct end labels cannot collide. */
export function labelsFit(ys: number[], gap = 13): boolean {
  const s = [...ys].sort((a, b) => a - b);
  return s.every((y, i) => i === 0 || y - s[i - 1] >= gap);
}

/** Print every k-th x-axis label so neighbours stay at least `minPx` apart; returns k. */
export function labelStride(n: number, widthPx: number, minPx = 56): number {
  if (n <= 1) return 1;
  return Math.max(1, Math.ceil((minPx * n) / Math.max(1, widthPx)));
}

/** One sentence for a screen reader: what the chart is, how big, and the headline of each series. */
export function describeSeries(kind: string, title: string, labels: string[], series: Series[], unit?: string): string {
  const parts = series.map((s) => {
    const vals = s.values.filter((v): v is number => typeof v === "number");
    if (!vals.length) return `${s.name}: no data`;
    const last = [...s.values].reverse().find((v) => typeof v === "number") as number;
    return `${s.name}: from ${withUnit(Math.min(...vals), unit)} to ${withUnit(Math.max(...vals), unit)}, latest ${withUnit(last, unit)}`;
  });
  const range = labels.length > 1 ? ` from ${labels[0]} to ${labels[labels.length - 1]}` : labels.length === 1 ? ` for ${labels[0]}` : "";
  return `${kind} chart${title ? `: ${title}` : ""}. ${labels.length} points${range}. ${parts.join("; ")}.`;
}

/** Epoch ms for a number or ISO string timestamp; NaN when unreadable. */
export const toMs = (t: number | string): number => (typeof t === "number" ? t : Date.parse(t));
