"use client";
import { useState } from "react";
import { arcPath, compact, donutAngles, round, withUnit } from "@/lib/charts/scale";
import { DataTable, seriesColor } from "./shared";

/** Part-to-whole ring (at most 8 slices) with a 2px surface gap between slices, the total or hovered slice in the
 *  middle, and a legend that carries every name, value and share (so nothing depends on colour alone). */
export default function Donut({ title, slices, unit }: { title: string; slices: { label: string; value: number }[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const angles = donutAngles(slices.map((s) => s.value));
  const total = slices.reduce((s, x) => s + x.value, 0);
  const pct = (i: number) => `${round(angles[i].share * 100, 0)}%`;
  const summary = `Donut chart${title ? `: ${title}` : ""}. ${slices.map((s, i) => `${s.label} ${withUnit(s.value, unit)} (${pct(i)})`).join(", ")}.`;
  const shown = hover === null ? null : slices[hover];
  return (
    <div className="ch ch-donut">
      <svg viewBox="0 0 150 150" role="img" aria-label={summary} onPointerLeave={() => setHover(null)}>
        {angles.map((a, i) => (
          <path key={i} className="ch-in" d={arcPath(75, 75, 70, 46, a.a0, a.a1)} fill={seriesColor(i)} stroke="var(--ch-surface)" strokeWidth={2}
            opacity={hover === null || hover === i ? 1 : 0.45} onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
        ))}
        <text className="big" x={75} y={shown ? 76 : 80} textAnchor="middle">{compact(shown ? shown.value : total)}</text>
        {shown && <text x={75} y={94} textAnchor="middle">{pct(hover!)}</text>}
      </svg>
      <ul className="ch-legend" aria-hidden="true">
        {slices.map((s, i) => (
          <li key={i} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <span className="ch-key" style={{ background: seriesColor(i) }} />{s.label}<span className="v">{withUnit(s.value, unit)} · {pct(i)}</span>
          </li>
        ))}
      </ul>
      <DataTable caption={title || summary} columns={["", "Value", "Share"]} rows={slices.map((s, i) => [s.label, s.value, pct(i)])} />
    </div>
  );
}
