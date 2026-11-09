"use client";
import { useRef, useState } from "react";
import { areaPath, barPath, describeSeries, labelStride, labelsFit, linePath, niceScale, withUnit, type Series } from "@/lib/charts/scale";
import { DataTable, Legend, Tip, seriesColor, useWidth } from "./shared";

export type CartesianProps = {
  kind: "bar" | "line" | "area";
  title: string;
  labels: string[];
  series: Series[];
  unit?: string;
  height?: number;
  /** Force upright bars: a single series of bars is horizontal by default (ranked categories), but time series are not. */
  upright?: boolean;
};

const M = { top: 8, bottom: 22, left: 40, right: 10 };

/** Bar, line and area charts on one frame: zero-based bars with 4px rounded data ends, 2px lines, a 10% area wash,
 *  recessive hairline grid, end-of-line labels when they cannot collide, a legend for 2+ series, a hover readout
 *  and a hidden data table. A single series of bars turns horizontal so the labels stay readable. */
export default function CartesianChart({ kind, title, labels, series, unit, height = 180, upright }: CartesianProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const nums = series.flatMap((s) => s.values).filter((v): v is number => typeof v === "number");
  const zero = kind !== "line";
  const sc = niceScale(Math.min(...nums, zero ? 0 : Infinity), Math.max(...nums, zero ? 0 : -Infinity));
  const horizontal = kind === "bar" && series.length === 1 && !upright;
  const summary = describeSeries(kind === "bar" ? "Bar" : kind === "line" ? "Line" : "Area", title, labels, series, unit);
  const table = <DataTable caption={title || summary} columns={["", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => s.values[i] ?? "")])} />;
  const legend = series.length > 1 ? <Legend names={series.map((s) => s.name)} line={kind !== "bar"} /> : null;

  if (horizontal) {
    const rowH = 26;
    const labW = Math.min(width * 0.38, 150);
    const h = n * rowH + 6;
    const x0 = labW + 8;
    const iw = Math.max(40, width - x0 - 52);
    const xv = (v: number) => x0 + ((v - sc.min) / (sc.max - sc.min)) * iw;
    const base = xv(0);
    const vals = series[0].values;
    return (
      <div className="ch" ref={ref}>
        <svg viewBox={`0 0 ${width} ${h}`} height={h} role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
          {sc.ticks.map((t) => <line key={t} className="ch-grid" x1={xv(t)} x2={xv(t)} y1={0} y2={h - 4} />)}
          {labels.map((l, i) => {
            const v = vals[i];
            const cy = i * rowH + rowH / 2 + 2;
            return (
              <g key={i} onPointerMove={() => setHover(i)}>
                <rect x={0} y={i * rowH} width={width} height={rowH} fill="transparent" />
                {hover === i && <rect className="ch-band" x={0} y={i * rowH} width={width} height={rowH} rx={6} />}
                <text x={labW} y={cy + 4} textAnchor="end">{l.length > 22 ? `${l.slice(0, 21)}…` : l}</text>
                {typeof v === "number" && (
                  <>
                    <path className="ch-in" d={hBar(base, xv(v), cy - 8, 16)} fill={seriesColor(0)} />
                    <text x={Math.max(base, xv(v)) + 6} y={cy + 4}>{withUnit(v, unit)}</text>
                  </>
                )}
              </g>
            );
          })}
          <line className="ch-base" x1={base} x2={base} y1={0} y2={h - 4} />
        </svg>
        {table}
      </div>
    );
  }

  const iw0 = Math.max(60, width - M.left - M.right);
  const ih = height - M.top - M.bottom;
  const y = (v: number) => M.top + (1 - (v - sc.min) / (sc.max - sc.min)) * ih;
  const baseY = y(zero ? 0 : sc.min);
  // End labels need room on the right and must not collide; otherwise the legend and hover carry identity.
  const ends = series.map((s) => { const i = s.values.reduce<number>((a, v, k) => (typeof v === "number" ? k : a), -1); return i < 0 ? null : y(s.values[i] as number); });
  const labelled = kind !== "bar" && series.length > 1 && series.length <= 4 && width >= 420 && ends.every((e) => e !== null) && labelsFit(ends as number[]);
  const labW = labelled ? Math.min(96, Math.max(...series.map((s) => s.name.length)) * 6 + 10) : 0;
  const iw = iw0 - labW;
  const band = iw / Math.max(1, n);
  const xAt = (i: number) => (kind === "bar" ? M.left + band * (i + 0.5) : M.left + (n === 1 ? iw / 2 : (i * iw) / (n - 1)));
  const stride = labelStride(n, iw, Math.max(56, Math.max(...labels.map((l) => l.length)) * 6.4 + 18)); // wide labels need more room
  const S = series.length;
  const gap = 2;
  const bw = Math.max(2, Math.min(24, (band * 0.8 - gap * (S - 1)) / S));
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left - M.left;
    const i = kind === "bar" ? Math.floor(px / band) : Math.round((px / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };

  return (
    <div className="ch" ref={ref}>
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={summary} onPointerMove={pick} onPointerDown={pick} onPointerLeave={() => setHover(null)}>
        {sc.ticks.map((t) => (
          <g key={t}>
            <line className={t === 0 && zero ? "ch-base" : "ch-grid"} x1={M.left} x2={M.left + iw} y1={y(t)} y2={y(t)} />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end">{withUnit(t, unit)}</text>
          </g>
        ))}
        {labels.map((l, i) => i % stride === 0 && <text key={i} x={xAt(i)} y={height - 6} textAnchor="middle">{l}</text>)}
        {hover !== null && kind === "bar" && <rect className="ch-band" x={M.left + band * hover} y={M.top} width={band} height={ih} rx={6} />}
        {hover !== null && kind !== "bar" && <line className="ch-cross" x1={xAt(hover)} x2={xAt(hover)} y1={M.top} y2={baseY} />}
        {series.map((s, si) => {
          const color = seriesColor(si);
          if (kind === "bar") {
            const gx = xAt(0) - band / 2 + (band - (S * bw + gap * (S - 1))) / 2;
            return <g key={si} className="ch-in" fill={color}>{s.values.map((v, i) => typeof v === "number" && <path key={i} d={barPath(gx + band * i + si * (bw + gap), y(v), bw, y(0))} />)}</g>;
          }
          const pts = s.values.map((v, i) => (typeof v === "number" ? { x: xAt(i), y: y(v) } : null));
          const last = [...pts].reverse().find(Boolean);
          return (
            <g key={si} className="ch-in">
              {kind === "area" && <path d={areaPath(pts, baseY)} fill={color} opacity={0.12} />}
              <path d={linePath(pts)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {last && n > 1 && <circle className="ch-ring" cx={last.x} cy={last.y} r={4} fill={color} />}
              {n === 1 && last && <circle className="ch-ring" cx={last.x} cy={last.y} r={4} fill={color} />}
              {labelled && last && <text x={last.x + 10} y={last.y + 4}>{s.name}</text>}
              {hover !== null && pts[hover] && <circle className="ch-ring" cx={pts[hover]!.x} cy={pts[hover]!.y} r={4} fill={color} />}
            </g>
          );
        })}
      </svg>
      {hover !== null && <Tip x={xAt(hover)} width={width} title={labels[hover]} rows={series.map((s, i) => ({ color: seriesColor(i), name: s.name, value: typeof s.values[hover] === "number" ? withUnit(s.values[hover] as number, unit) : "no data" }))} />}
      {legend}
      {table}
    </div>
  );
}

/** Horizontal bar from `x0` to `x1` (either direction), 4px rounded at the data end. */
function hBar(x0: number, x1: number, y: number, h: number): string {
  const w = Math.abs(x1 - x0);
  if (w < 0.5) return "";
  const r = Math.min(4, w, h / 2);
  if (x1 >= x0) return `M${x0} ${y}H${x1 - r}Q${x1} ${y} ${x1} ${y + r}V${y + h - r}Q${x1} ${y + h} ${x1 - r} ${y + h}H${x0}Z`;
  return `M${x0} ${y}H${x1 + r}Q${x1} ${y} ${x1} ${y + r}V${y + h - r}Q${x1} ${y + h} ${x1 + r} ${y + h}H${x0}Z`;
}
