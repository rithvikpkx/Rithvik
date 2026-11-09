/** Small server-safe building blocks for the admin pages: cards, KPI tiles, ranked bars, a segmented bar, empties. */
import type { ReactNode } from "react";
import type { Ranked } from "@/lib/analytics/types";

/** A titled card spanning `span` of 12 columns. */
export function Card({ title, note, span = 12, children, id, action }: { title?: string; note?: ReactNode; span?: 3 | 4 | 5 | 6 | 7 | 8 | 12; children: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <section className={`adm-card s${span}`} id={id} aria-label={title}>
      {(title || note || action) && (
        <div className="adm-card-h"><h3>{title}</h3>{note && <p>{note}</p>}{action}</div>
      )}
      {children}
    </section>
  );
}

/** Section heading with an anchor id for the jump bar. */
export function Section({ id, eyebrow, title, note, children }: { id: string; eyebrow: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="adm-sec" id={id} aria-labelledby={`${id}-h`}>
      <div className="adm-sec-h">
        <span className="adm-eyebrow">{eyebrow}</span>
        <h2 id={`${id}-h`}>{title}</h2>
        {note && <p>{note}</p>}
      </div>
      {children}
    </section>
  );
}

/** Signed change chip: "▲ 12%" / "▼ 8%"; `goodUp` false flips which direction is green (e.g. bounce). */
export function Delta({ d, goodUp = true }: { d: number | null; goodUp?: boolean }) {
  if (d === null || !Number.isFinite(d)) return null;
  const pct = Math.abs(d) < 0.005 ? "0%" : `${Math.round(Math.abs(d) * 100)}%`;
  const dir = Math.abs(d) < 0.005 ? "" : d > 0 ? "up" : "down";
  const good = dir === "" ? "" : (dir === "up") === goodUp ? "up" : "down";
  return (
    <span className={`adm-delta ${good}`} title="vs the previous period">
      <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "•"}</span>
      <span className="sr-only">{dir === "up" ? "up" : dir === "down" ? "down" : "unchanged"}</span>{pct}
    </span>
  );
}

/** A ranked list with a thin bar per row (bar length relative to the largest value). Zero rows read as unused. */
export function RankBars({ rows, unit, empty, max: cap = 10, total }: { rows: Ranked[]; unit?: string; empty?: string; max?: number; total?: number }) {
  const shown = rows.slice(0, cap);
  if (!shown.length) return <Empty>{empty ?? "Nothing recorded in this period."}</Empty>;
  const top = Math.max(1, ...shown.map((r) => r.value));
  return (
    <ol className="adm-rank">
      {shown.map((r, i) => {
        const label = <>{r.label}{r.sub && <small>{r.sub}</small>}</>;
        return (
          <li key={`${r.label}-${i}`} className={r.value === 0 ? "zero" : undefined}>
            <span className="l" title={r.label}>{r.href ? <a href={r.href}>{label}</a> : label}</span>
            <span className="v"><b>{r.value.toLocaleString("en-US")}</b>{unit}{total ? ` · ${Math.round((r.value / total) * 100)}%` : ""}</span>
            <span className="bar" aria-hidden="true"><i style={{ ["--w" as string]: `${(r.value / top) * 100}%` }} /></span>
          </li>
        );
      })}
    </ol>
  );
}

/** One whole split into parts: a thin segmented bar plus a legend with shares (identity never by colour alone). */
export function Split({ rows, empty }: { rows: Ranked[]; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <Empty>{empty ?? "Nothing recorded in this period."}</Empty>;
  const parts = rows.slice(0, 7);
  const rest = rows.slice(7).reduce((s, r) => s + r.value, 0);
  const all = rest ? [...parts, { label: "other", value: rest }] : parts;
  const color = (i: number) => (i < 7 ? `var(--ch-${i + 1})` : "var(--ui-muted)");
  return (
    <div className="adm-split ch" role="img" aria-label={all.map((r) => `${r.label} ${Math.round((r.value / total) * 100)}%`).join(", ")}>
      <div className="track" aria-hidden="true">
        {all.map((r, i) => r.value > 0 && <i key={r.label} title={`${r.label}: ${r.value}`} style={{ flex: r.value, background: color(i) }} />)}
      </div>
      <ul aria-hidden="true">
        {all.map((r, i) => (
          <li key={r.label}><span className="k" style={{ background: color(i) }} /><span className="t">{r.label}</span><span className="p">{Math.round((r.value / total) * 100)}%</span></li>
        ))}
      </ul>
    </div>
  );
}

/** An explanatory empty state: what will appear here, and when. */
export function Empty({ title, children }: { title?: string; children: ReactNode }) {
  return <div className="adm-empty">{title && <b>{title}</b>}<span>{children}</span></div>;
}

/** Initials for an avatar tile. */
export function initials(s: string): string {
  const w = s.replace(/[@.].*$/, "").split(/[\s_-]+/).filter(Boolean);
  return ((w[0]?.[0] ?? "?") + (w[1]?.[0] ?? "")).toUpperCase();
}

/** "3m ago" / "2h ago" / "Nov 3" relative to `now` (UTC, locale-free so server and client agree). */
export function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "–";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
