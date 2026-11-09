"use client";
import { useState } from "react";
import CartesianChart from "@/components/site/charts/CartesianChart";
import { bucketLabel, fmtInt, fmtMs, fmtRate, fmtUsd } from "@/lib/status/format";
import type { StatusData } from "@/lib/status/types";

type Range = "24h" | "7d";

/** The traffic half of the page: a 24h / 7d switch (the only interactive part), headline tiles and three charts. */
export default function StatusPanels({ data }: { data: StatusData }) {
  const [range, setRange] = useState<Range>("24h");
  const w = data.windows[range];
  const labels = w.series.map((b) => bucketLabel(b.t, range));
  const span = range === "24h" ? "last 24 hours" : "last 7 days";
  const tiles: { label: string; value: string; note: string }[] = [
    { label: "Requests", value: fmtInt(w.requests), note: `${fmtInt(w.errors)} failed` },
    { label: "Error rate", value: fmtRate(w.errorRate), note: "of requests" },
    { label: "Cache hit rate", value: fmtRate(w.cacheHitRate), note: `${fmtInt(w.cacheHits)} answered from cache` },
    { label: "Time to first byte", value: fmtMs(w.ttfbMs.p50), note: `p50 · p95 ${fmtMs(w.ttfbMs.p95)}` },
    { label: "Full answer", value: fmtMs(w.totalMs.p50), note: `p50 · p95 ${fmtMs(w.totalMs.p95)}` },
    { label: "Tokens", value: fmtInt(w.tokens), note: `est. cost ${fmtUsd(w.estCostUsd)}` },
  ];
  return (
    <section aria-labelledby="st-traffic">
      <div className="st-bar">
        <h2 id="st-traffic">Chat traffic</h2>
        <div className="st-seg" role="group" aria-label="Time range">
          {(["24h", "7d"] as const).map((r) => <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)}>{r === "24h" ? "24 hours" : "7 days"}</button>)}
        </div>
      </div>
      <ul className="st-tiles" aria-label={`Headline numbers, ${span}`}>
        {tiles.map((t) => <li key={t.label} className="st-tile"><span className="l">{t.label}</span><span className="v">{t.value}</span><span className="n">{t.note}</span></li>)}
      </ul>
      {w.requests === 0 ? (
        <p className="st-empty">No chat requests in the {span}.</p>
      ) : (
        <div className="st-charts">
          <figure className="st-card"><figcaption>Requests per {range === "24h" ? "hour" : "6 hours"}</figcaption>
            <CartesianChart kind="bar" upright title={`Requests, ${span}`} labels={labels} series={[{ name: "Requests", values: w.series.map((b) => b.requests) }]} height={190} />
          </figure>
          <figure className="st-card"><figcaption>Median time to first byte</figcaption>
            <CartesianChart kind="line" title={`Median time to first byte, ${span}`} unit="ms" labels={labels} series={[{ name: "p50 TTFB", values: w.series.map((b) => b.p50TtfbMs) }]} height={190} />
          </figure>
          <figure className="st-card wide"><figcaption>Model mix, by requests</figcaption>
            <CartesianChart kind="bar" title={`Requests by model, ${span}`} labels={w.models.map((m) => m.model)} series={[{ name: "Requests", values: w.models.map((m) => m.requests) }]} />
          </figure>
        </div>
      )}
    </section>
  );
}
