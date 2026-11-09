"use client";
import { useMemo } from "react";
import { timelineLayout } from "@/lib/charts/scale";
import { DataTable } from "./shared";

export type TimelineItem = { label: string; start: string; end?: string; note?: string };

/** One row per item on a shared year axis: a bar from start to end (open-ended "present" bars fade out at the
 *  right). Laid out in percentages, so it needs no measuring and wraps on a phone. */
export default function Timeline({ title, items }: { title: string; items: TimelineItem[] }) {
  // `now` only matters for "present"; computed once per mount so SSR and hydration agree to the month
  const now = useMemo(() => new Date(), []);
  const { rows, ticks } = timelineLayout(items, now);
  const span = (i: TimelineItem) => `${i.start}${i.end ? ` to ${i.end}` : ""}`;
  const summary = `Timeline${title ? `: ${title}` : ""}. ${items.map((i) => `${i.label}, ${span(i)}`).join("; ")}.`;
  return (
    <div className="ch ch-tl" role="img" aria-label={summary}>
      <div className="ch-tl-axis" aria-hidden="true">
        <span />
        <div className="ch-tl-track">{ticks.map((t) => <span key={t.year} className="ch-tl-tick" style={{ left: `${t.at}%` }}>{t.year}</span>)}</div>
      </div>
      {items.map((it, i) => {
        const r = rows[i];
        return (
          <div className="ch-tl-row" key={i} aria-hidden="true">
            <div className="ch-tl-name">{it.label}{it.note && <small>{it.note}</small>}</div>
            <div className="ch-tl-track">{r && <span className={`ch-tl-bar ch-in${/^(present|now)$/i.test(it.end ?? "") ? " open" : ""}`} style={{ left: `${r.left}%`, width: `${Math.min(r.width, 100 - r.left)}%` }} title={span(it)} />}</div>
            <div className="ch-tl-dates">{span(it).replace(" to ", " – ")}</div>
          </div>
        );
      })}
      <DataTable caption={title || summary} columns={["Item", "Start", "End", "Note"]} rows={items.map((i) => [i.label, i.start, i.end ?? "", i.note ?? ""])} />
    </div>
  );
}
