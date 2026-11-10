"use client";
import { useId, useRef, useState } from "react";
import { useWidth, DataTable } from "@/components/site/charts/shared";

type Series = { name: string; values: number[] };

/** Smooth monotone-ish path through points (Catmull-Rom to Bézier, tension 0.5): soft curves that never overshoot far. */
function smooth(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]} ${pts[0][1]}` : "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

/** The traffic pulse: the first series as a glowing area, the rest as thin lines, drawn on from the left. Hover (or
 *  touch) reads out a bucket; the data is also a hidden table for screen readers. */
export default function Pulse({ labels, series, height = 220, title, tone }: { labels: string[]; series: Series[]; height?: number; title: string; tone?: "amber" }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref, 900);
  const [hover, setHover] = useState<number | null>(null);
  const gid = `pf${useId().replace(/[^a-z0-9]/gi, "")}`;
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const top = 14, bottom = 26, H = height;
  const x = (i: number) => (n <= 1 ? w / 2 : (i * (w - 2)) / (n - 1) + 1);
  const y = (v: number) => top + (1 - v / max) * (H - top - bottom);
  const paths = series.map((s) => smooth(s.values.map((v, i) => [x(i), y(v)])));
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(w / 90))));
  return (
    <div className={`d-pulse${tone ? ` ${tone}` : ""}`} ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} height={H} role="img" aria-label={title}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1))); }}
        onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--c, var(--pink))", stopOpacity: 0.38 }} />
            <stop offset="1" style={{ stopColor: "var(--c, var(--pink))", stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={y(max * f)} y2={y(max * f)} className="d-gl" />)}
        {paths[0] && <path d={`${paths[0]} L${x(n - 1)} ${H - bottom} L${x(0)} ${H - bottom} Z`} fill={`url(#${gid})`} className="d-pulse-area" />}
        {paths.map((d, i) => <path key={i} d={d} pathLength={1} className={`d-pulse-line s${i}`} />)}
        {labels.map((l, i) => (i % every === 0 ? <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : "middle"} className="d-tick">{l}</text> : null))}
        {hover !== null && hover >= 0 && hover < n && (
          <g className="d-cross">
            <line x1={x(hover)} x2={x(hover)} y1={top - 6} y2={H - bottom} />
            {series.map((s, i) => <circle key={i} cx={x(hover)} cy={y(s.values[hover])} r={4} className={`s${i}`} />)}
          </g>
        )}
      </svg>
      {hover !== null && hover >= 0 && hover < n && (
        <div className="d-tip" style={x(hover) > w / 2 ? { right: w - x(hover) + 12 } : { left: x(hover) + 12 }}>
          <b>{labels[hover]}</b>
          {series.map((s, i) => <span key={i} className={`s${i}`}>{s.name}<em>{s.values[hover]}</em></span>)}
        </div>
      )}
      <DataTable caption={title} columns={["Bucket", ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => s.values[i])])} />
    </div>
  );
}
