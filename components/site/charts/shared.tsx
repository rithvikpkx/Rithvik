"use client";
import { useEffect, useState, type RefObject } from "react";
import "./charts.css";

/** Categorical colour for series `i` (fixed order, never cycled past 8: callers cap their series). */
export const seriesColor = (i: number): string => `var(--ch-${(i % 8) + 1})`;

/** Width of `ref`'s element, kept live with a ResizeObserver; `fallback` until it is measured (and on the server). */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback = 560): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setW(Math.max(1, Math.round(el.getBoundingClientRect().width)));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The chart's data as a real table, visually hidden unless `visible`: the text alternative to the picture. */
export function DataTable({ caption, columns, rows, visible }: { caption: string; columns: string[]; rows: (string | number)[][]; visible?: boolean }) {
  return (
    <div className={visible ? "ch-scroll ch-data" : "sr-only"}>
      <table className="ch-table">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c, i) => <th key={i} scope="col" className={i > 0 && typeof rows[0]?.[i] === "number" ? "num" : undefined}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} className={typeof c === "number" ? "num" : undefined}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** Colour key + name for every series (always shown for two or more, so identity is never colour alone). */
export function Legend({ names, line }: { names: string[]; line?: boolean }) {
  return (
    <ul className="ch-legend" aria-hidden="true">
      {names.map((n, i) => <li key={i}><span className={`ch-key${line ? " line" : ""}`} style={{ background: seriesColor(i) }} />{n}</li>)}
    </ul>
  );
}

/** Hover readout: a title and one row per series, positioned beside `x` (px) and flipped near the right edge. */
export function Tip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { color?: string; name: string; value: string }[] }) {
  const flip = x > width / 2;
  return (
    <div className="ch-tip" role="presentation" style={flip ? { right: Math.max(0, width - x + 12) } : { left: x + 12 }}>
      <b>{title}</b>
      {rows.map((r, i) => <div key={i}>{r.color && <span className="ch-key" style={{ background: r.color }} />}<span>{r.name}</span><span className="v">{r.value}</span></div>)}
    </div>
  );
}
