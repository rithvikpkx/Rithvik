"use client";
import { useRef, useState } from "react";
import { compact, linePath, niceScale, withUnit } from "@/lib/charts/scale";
import { fmtStamp } from "@/lib/status/format";
import { DataTable, Tip, useWidth } from "./shared";

/** A plain table of strings (numbers right-aligned when a column is numeric). */
export function Table({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const numeric = columns.map((_, j) => rows.length > 0 && rows.every((r) => /^[-+$]?[\d.,]+[%kMx]?$/.test((r[j] ?? "").trim())));
  return (
    <div className="ch ch-scroll">
      <table className="ch-table">
        <thead><tr>{columns.map((c, i) => <th key={i} scope="col" className={numeric[i] ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{columns.map((_, j) => <td key={j} className={numeric[j] ? "num" : undefined}>{r[j] ?? ""}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A row of headline numbers: label, value, optional note. A figure, not a chart, so no plot and no hover. */
export function StatRow({ items }: { items: { label: string; value: string; note?: string }[] }) {
  return (
    <ul className="ch ch-stats">
      {items.map((s, i) => (
        <li key={i} className="ch-stat"><span className="l">{s.label}</span><span className="v">{s.value}</span>{s.note && <span className="n">{s.note}</span>}</li>
      ))}
    </ul>
  );
}

/** A 28px-tall line with an end dot, for a trend beside a number. Decorative unless `label` is given. */
export function Sparkline({ values, label, unit, height = 28 }: { values: (number | null)[]; label?: string; unit?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref, 120);
  const nums = values.filter((v): v is number => typeof v === "number");
  if (!nums.length) return <div className="ch" ref={ref} style={{ height }} />;
  const sc = niceScale(Math.min(...nums), Math.max(...nums), 2);
  const x = (i: number) => 4 + (values.length === 1 ? (w - 8) / 2 : (i * (w - 8)) / (values.length - 1));
  const y = (v: number) => 4 + (1 - (v - sc.min) / (sc.max - sc.min)) * (height - 8);
  const pts = values.map((v, i) => (typeof v === "number" ? { x: x(i), y: y(v) } : null));
  const last = [...pts].reverse().find(Boolean)!;
  const lastV = [...nums].pop()!;
  return (
    <div className="ch" ref={ref}>
      <svg viewBox={`0 0 ${w} ${height}`} height={height} role={label ? "img" : undefined} aria-label={label ? `${label}: latest ${withUnit(lastV, unit)}, range ${compact(Math.min(...nums))} to ${compact(Math.max(...nums))}` : undefined} aria-hidden={label ? undefined : true}>
        <path d={linePath(pts)} fill="none" style={{ color: "var(--ch-1)" }} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle className="ch-ring" cx={last.x} cy={last.y} r={4} style={{ color: "var(--ch-1)" }} fill="currentColor" />
      </svg>
    </div>
  );
}

export type Check = { t: number | string; ok: boolean; ms: number | null };

/** The last N health checks as ticks: a passing check is a short green tick, a failing one a full-height red tick
 *  (shape as well as colour), with a hover readout and a text summary of the failures. */
export function UptimeStrip({ checks }: { checks: Check[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useWidth(ref, 600);
  const [hover, setHover] = useState<number | null>(null);
  const n = checks.length;
  const failed = checks.filter((c) => !c.ok).length;
  const H = 32;
  const step = n ? w / n : w;
  // a 1.5px gap between ticks when there is room; on a phone the ticks touch instead of aliasing into stripes
  const tw = step >= 3 ? Math.min(8, step - 1.5) : step;
  const fmt = fmtStamp; // UTC and locale-free, so the server render and the browser agree
  const summary = n ? `Uptime strip: ${n} checks, ${failed === 0 ? "all passed" : `${failed} failed`}, from ${fmt(checks[0].t)} to ${fmt(checks[n - 1].t)}.` : "Uptime strip: no checks recorded yet.";
  return (
    <div className="ch" ref={ref}>
      <svg viewBox={`0 0 ${w} ${H}`} height={H} role="img" aria-label={summary}
        onPointerMove={(e) => setHover(Math.min(n - 1, Math.max(0, Math.floor((e.clientX - e.currentTarget.getBoundingClientRect().left) / step))))} onPointerLeave={() => setHover(null)}>
        {checks.map((c, i) => (
          <rect key={i} x={i * step} y={c.ok ? 6 : 0} width={tw} height={c.ok ? H - 12 : H} rx={Math.min(2, tw / 2)}
            style={{ fill: c.ok ? "var(--ch-good)" : "var(--ch-bad)" }} opacity={hover === null || hover === i ? 1 : 0.55} />
        ))}
      </svg>
      {hover !== null && checks[hover] && (
        <Tip x={hover * step} width={w} title={fmt(checks[hover].t)} rows={[{ name: checks[hover].ok ? "Passed" : "Failed", value: checks[hover].ms === null ? "no response" : `${Math.round(checks[hover].ms!)} ms` }]} />
      )}
      <DataTable caption="Health checks" columns={["Time", "Result", "Response"]} rows={checks.slice(-48).map((c) => [fmt(c.t), c.ok ? "Passed" : "Failed", c.ms === null ? "" : `${Math.round(c.ms)} ms`])} />
    </div>
  );
}
