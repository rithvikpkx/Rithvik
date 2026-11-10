/** Small server-safe building blocks for the dashboards: sections, instrument panels, ranked rows, splits, deltas,
 *  empties and relative times. */
import type { CSSProperties, ReactNode } from "react";
import type { Ranked } from "@/lib/analytics/types";
import { Logo } from "./live";

/** A one-word section with a mono index ("01") and a hairline running to the right edge; `meta` sits on the line. */
export function Section({ id, n, title, meta, children }: { id: string; n: string; title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="d-sec" id={id} aria-labelledby={`${id}-h`}>
      <header className="d-sec-h"><span className="d-idx">{n}</span><h2 id={`${id}-h`}>{title}</h2><span className="d-rule" />{meta && <span className="d-sec-m">{meta}</span>}</header>
      {children}
    </section>
  );
}

/** An instrument panel: hairline frame with corner ticks, a small mono label, spanning `span` of 12 columns. */
export function Panel({ label, aside, span = 12, children, className, i = 0 }: { label?: string; aside?: ReactNode; span?: 3 | 4 | 5 | 6 | 7 | 8 | 12; children: ReactNode; className?: string; i?: number }) {
  return (
    <section className={`d-panel s${span}${className ? ` ${className}` : ""}`} aria-label={label} style={{ ["--i" as string]: i } as CSSProperties}>
      {(label || aside) && <header className="d-panel-h">{label && <h3>{label}</h3>}{aside && <span>{aside}</span>}</header>}
      {children}
    </section>
  );
}

/** Signed change against the previous period; `goodUp` false flips which direction reads as good (e.g. bounce). */
export function Delta({ d, goodUp = true }: { d: number | null; goodUp?: boolean }) {
  if (d === null || !Number.isFinite(d)) return null;
  const flat = Math.abs(d) < 0.005;
  const good = flat ? "" : (d > 0) === goodUp ? "up" : "down";
  return (
    <span className={`d-delta ${good}`} title="vs the previous period">
      <span aria-hidden="true">{flat ? "·" : d > 0 ? "↑" : "↓"}</span>
      <span className="sr-only">{flat ? "unchanged" : d > 0 ? "up" : "down"}</span>{flat ? "0%" : `${Math.round(Math.abs(d) * 100)}%`}
    </span>
  );
}

/** Ranked rows: label (with a logo when `logos`), value, share, and a hairline bar that grows in on entry. */
export function Ranks({ rows, empty, max: cap = 8, total, logos, tone = "pink" }: { rows: Ranked[]; empty?: string; max?: number; total?: number; logos?: boolean; tone?: "pink" | "amber" | "sky" }) {
  const shown = rows.slice(0, cap);
  if (!shown.length || shown.every((r) => !r.value)) return <Empty>{empty ?? "Nothing in this period."}</Empty>;
  const top = Math.max(1, ...shown.map((r) => r.value));
  return (
    <ol className={`d-ranks t-${tone}`}>
      {shown.map((r, i) => {
        const body = <>{logos && <Logo host={r.label} fallback={<span className="d-logo-x" aria-hidden="true">{r.label === "direct" ? "→" : r.label.slice(0, 1)}</span>} />}<span className="t">{r.label}</span>{r.sub && <small>{r.sub}</small>}</>;
        return (
          <li key={`${r.label}-${i}`} className={r.value ? undefined : "zero"} style={{ ["--w" as string]: `${(r.value / top) * 100}%`, ["--i" as string]: i } as CSSProperties}>
            <span className="l" title={r.label}>{r.href ? <a href={r.href}>{body}</a> : body}</span>
            <span className="v"><b>{r.value.toLocaleString("en-US")}</b>{total ? <em>{Math.round((r.value / total) * 100)}%</em> : null}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** One whole in parts: a segmented hairline bar with the parts listed under it (share in text, never colour alone). */
export function Split({ rows, empty }: { rows: Ranked[]; empty?: string }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <Empty>{empty ?? "Nothing in this period."}</Empty>;
  const parts = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((s, r) => s + r.value, 0);
  const all = rest ? [...parts, { label: "other", value: rest }] : parts;
  return (
    <div className="d-split" role="img" aria-label={all.map((r) => `${r.label} ${Math.round((r.value / total) * 100)}%`).join(", ")}>
      <div className="track" aria-hidden="true">{all.map((r, i) => r.value > 0 && <i key={r.label} className={`c${i}`} style={{ flex: r.value }} />)}</div>
      <ul aria-hidden="true">{all.map((r, i) => <li key={r.label}><span className={`k c${i}`} />{r.label}<b>{Math.round((r.value / total) * 100)}%</b></li>)}</ul>
    </div>
  );
}

/** What will appear here, and when. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="d-empty">{children}</p>;
}

/** "3m" / "2h" / "4d" / "Nov 3" relative to `now` (UTC, locale-free so server and client agree). */
export function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "–";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Today" / "Yesterday" / "Nov 7" for grouping a list by UTC day. */
export function dayLabel(iso: string, now: number): string {
  const d = Math.floor(Date.parse(iso) / 86_400_000), today = Math.floor(now / 86_400_000);
  if (d === today) return "Today";
  if (d === today - 1) return "Yesterday";
  const t = new Date(d * 86_400_000);
  return `${MON[t.getUTCMonth()]} ${t.getUTCDate()}`;
}

/** "2026-11-09 14:03 UTC". */
export const stamp = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} utc`;

/** The domain of an email address when it looks like an employer's (not a free mail provider), for a logo. */
export function workDomain(email: string | null | undefined): string | null {
  const d = email?.split("@")[1]?.toLowerCase();
  if (!d || /^(gmail|googlemail|yahoo|outlook|hotmail|live|icloud|me|proton|protonmail|aol|gmx|yandex|qq|163)\./.test(d) || d.endsWith(".example")) return null;
  return d;
}
