/** The dashboard's own figures (server-safe SVG; entry animation is CSS, so they cost no JS): identity sigils, the
 *  day ring around the ouroboros, the section journey, the latency swarm, turn anatomy, glyph strips and small icons.
 *  Every figure carries a text alternative (aria-label or <title>). */
import type { ReactNode } from "react";
import Mark from "@/components/site/mark/Mark";
import { hash32, type StripMark } from "@/lib/analytics/strips";
import type { AnswerSample } from "@/lib/analytics/types";
import { fmtMs } from "@/lib/status/format";

const HUES = ["#ff4d8d", "#ffd166", "#4fe0a8", "#7cc4ff", "#b69cff"];
const TAU = Math.PI * 2;
const f1 = (n: number) => +n.toFixed(2);

/** An arc of radius r from angle a to b (radians, 0 = 12 o'clock, clockwise) as an SVG path. */
function arc(r: number, a: number, b: number): string {
  const p = (t: number) => `${f1(r * Math.sin(t))} ${f1(-r * Math.cos(t))}`;
  return `M${p(a)} A${r} ${r} 0 ${b - a > Math.PI ? 1 : 0} 1 ${p(b)}`;
}

/** A deterministic identity glyph for an id: an orbit of up to 12 arcs (some heavier) and an off-centre eye, in one
 *  of five hues. Echoes the ouroboros without copying it; the same id always draws the same sigil. */
export function Sigil({ id, size = 36, className }: { id: string; size?: number; className?: string }) {
  let h = hash32(id);
  if ((h & 0xfff).toString(2).replace(/0/g, "").length < 4) h |= 0b100100100101; // never a near-empty ring
  const hue = HUES[(h >>> 28) % HUES.length];
  const seg = TAU / 12, gap = 0.14;
  const eye = ((h >>> 24) & 15) / 16 * TAU;
  return (
    <svg className={`d-sigil${className ? ` ${className}` : ""}`} viewBox="-20 -20 40 40" width={size} height={size} aria-hidden="true" style={{ color: hue }}>
      <circle r="19" className="d-sigil-bg" />
      {Array.from({ length: 12 }, (_, i) => ((h >>> i) & 1 ? (
        <path key={i} d={arc(12.5, i * seg + gap, (i + 1) * seg - gap)} stroke="currentColor" fill="none" strokeLinecap="round"
          strokeWidth={(h >>> (i + 12)) & 1 ? 4.6 : 2.4} opacity={(h >>> (i + 12)) & 1 ? 1 : 0.6} />
      ) : null))}
      <circle cx={f1(4.5 * Math.sin(eye))} cy={f1(-4.5 * Math.cos(eye))} r="3" fill="currentColor" />
    </svg>
  );
}

/** Values around a ring with the ouroboros at its centre: one spoke per bucket, length = share of the busiest.
 *  `labels` marks the quarter points; `now` (an index) gets an amber tick. Spokes grow in on entry. */
export function DayRing({ values, labels, now, label, size = 300, children }: {
  values: number[]; labels: [string, string, string, string]; now?: number; label: string; size?: number; children?: ReactNode;
}) {
  const n = Math.max(1, values.length), max = Math.max(1, ...values);
  const R = 100, r0 = 58;
  const step = TAU / n;
  return (
    <figure className="d-ring" style={{ maxWidth: size }}>
      <svg viewBox="-124 -124 248 248" role="img" aria-label={label}>
        <circle r={r0 - 6} className="d-ring-track" />
        <circle r={R + 6} className="d-ring-track faint" />
        {values.map((v, i) => {
          const a = i * step + step / 2, len = (v / max) * (R - r0);
          const x1 = r0 * Math.sin(a), y1 = -r0 * Math.cos(a), x2 = (r0 + Math.max(2, len)) * Math.sin(a), y2 = -(r0 + Math.max(2, len)) * Math.cos(a);
          return (
            <line key={i} x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} pathLength={1} className={`d-spoke${v === max && v > 0 ? " peak" : ""}`}
              strokeWidth={Math.min(9, (TAU * r0) / n * 0.55)} style={{ ["--i" as string]: i, opacity: v ? 0.35 + 0.65 * (v / max) : 0.18 }}>
              <title>{`${v}`}</title>
            </line>
          );
        })}
        {now !== undefined && now >= 0 && now < n && (() => {
          const a = now * step + step / 2;
          return <circle cx={f1((R + 15) * Math.sin(a))} cy={f1(-(R + 15) * Math.cos(a))} r="3" className="d-ring-now" />;
        })()}
        {labels.map((t, q) => {
          const a = (q * TAU) / 4, rr = R + 17;
          return <text key={q} x={f1(rr * Math.sin(a))} y={f1(-rr * Math.cos(a))} className="d-ring-lbl" textAnchor={q === 1 ? "start" : q === 3 ? "end" : "middle"} dominantBaseline={q === 0 ? "auto" : q === 2 ? "hanging" : "middle"}>{t}</text>;
        })}
      </svg>
      <div className="d-ring-mark"><Mark kind="solid" blink label="" /></div>
      {children && <figcaption>{children}</figcaption>}
    </figure>
  );
}

const ORDER = ["top", "work", "experience", "about", "play", "questions", "contact"];

/** How far people get down the page: the site's sections in order as one river whose width is the visits that
 *  reached each, with dwell under each station. */
export function Journey({ sections, total }: { sections: { label: string; value: number; dwell: number | null }[]; total: number }) {
  const known = ORDER.map((id) => sections.find((s) => s.label === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const rest = sections.filter((s) => !ORDER.includes(s.label));
  const st = [...known, ...rest];
  if (!st.length) return null;
  const max = Math.max(1, total, ...st.map((s) => s.value));
  const W = 1000, H = 120, m = H / 2;
  const xs = st.map((_, i) => (st.length === 1 ? W / 2 : 40 + (i * (W - 80)) / (st.length - 1)));
  const hs = st.map((s) => Math.max(3, (s.value / max) * (H - 8)) / 2);
  // one edge of the river through every station (sign 1 = top, -1 = bottom), eased between stations
  const edge = (sign: 1 | -1, order: number[]) => order.map((i, j) => {
    const y = f1(m - sign * hs[i]);
    if (j === 0) return `L${xs[i]} ${y}`;
    const p = order[j - 1], cx = f1((xs[p] + xs[i]) / 2);
    return `C${cx} ${f1(m - sign * hs[p])} ${cx} ${y} ${xs[i]} ${y}`;
  }).join(" ");
  const idx = xs.map((_, i) => i), last = xs.length - 1;
  const top = `M0 ${f1(m - hs[0])} ${edge(1, idx)} L${W} ${f1(m - hs[last])}`;
  const bottomPts = `L${W} ${f1(m + hs[last])} ${edge(-1, [...idx].reverse())} L0 ${f1(m + hs[0])} Z`;
  return (
    <div className="d-journey">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Visits reaching each section: ${st.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <defs>
          <linearGradient id="d-river" x1="0" x2="1">
            <stop offset="0" style={{ stopColor: "var(--pink)", stopOpacity: 0.85 }} />
            <stop offset="1" style={{ stopColor: "var(--amber)", stopOpacity: 0.55 }} />
          </linearGradient>
        </defs>
        <path d={`${top} ${bottomPts}`} fill="url(#d-river)" className="d-river" />
        {xs.map((x, i) => <line key={i} x1={x} x2={x} y1={m - hs[i] - 4} y2={m + hs[i] + 4} className="d-river-st" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <ol className="d-stations" style={{ gridTemplateColumns: `repeat(${st.length}, minmax(0, 1fr))` }}>
        {st.map((s) => (
          <li key={s.label}>
            <b>{s.label}</b>
            <span>{Math.round((s.value / max) * 100)}%</span>
            {s.dwell ? <small>{s.dwell >= 60 ? `${Math.round(s.dwell / 60)}m` : `${Math.round(s.dwell)}s`}</small> : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Log-scale position of a duration (ms) between 100 ms and 20 s, as 0..1. */
const logX = (ms: number) => Math.min(1, Math.max(0, (Math.log10(Math.max(100, ms)) - 2) / (Math.log10(20_000) - 2)));

/** Every answer as a dot on a log time axis (full answer time), stacked into a swarm so clusters read as shapes:
 *  cache hits sit hollow on the left, failures are red, p50 and p95 are marked. Dots pop in left to right. */
export function Swarm({ samples, p50, p95 }: { samples: AnswerSample[]; p50: number | null; p95: number | null }) {
  const pts = samples.filter((s) => typeof s.total === "number" && s.total! > 0).slice(0, 900);
  const W = 1000, r = pts.length > 500 ? 2.6 : 3.6, d = r * 2.2, rows = 24;
  const cols = new Map<number, number>();
  const stacked = [...pts].sort((a, b) => a.total! - b.total!).map((s) => {
    const c = Math.round((logX(s.total!) * (W - 20)) / d);
    const k = cols.get(c) ?? 0;
    cols.set(c, k + 1);
    return { c, k: k % rows, s }; // a very tall column wraps instead of overflowing
  });
  const H = Math.max(96, Math.min(rows, Math.max(0, ...stacked.map((p) => p.k + 1))) * d + 46), base = H - 22;
  const placed = stacked.map(({ c, k, s }) => ({ x: 10 + c * d, y: base - r - 2 - k * d, s }));
  const ticks = [100, 250, 500, 1000, 2500, 5000, 10_000, 20_000];
  const mark = (ms: number | null, name: string) => ms === null ? null : (
    <g className="d-swarm-q" transform={`translate(${f1(10 + logX(ms) * (W - 20))} 0)`}>
      <line y1={4} y2={base} />
      <text y={2} textAnchor="middle">{name} {fmtMs(ms)}</text>
    </g>
  );
  return (
    <div className="d-swarm">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${pts.length} answers by full answer time: median ${fmtMs(p50)}, 95th percentile ${fmtMs(p95)}, ${pts.filter((p) => p.cached).length} from cache, ${pts.filter((p) => p.err).length} failed.`}>
        <line x1={10} x2={W - 10} y1={base + 2} y2={base + 2} className="d-axis" />
        {ticks.map((t) => <text key={t} x={f1(10 + logX(t) * (W - 20))} y={H - 4} textAnchor="middle" className="d-tick">{fmtMs(t).replace(" ", "")}</text>)}
        {mark(p50, "p50")}
        {mark(p95, "p95")}
        {placed.map(({ x, y, s }, i) => (
          <circle key={i} cx={f1(x)} cy={f1(y)} r={r} className={`d-dot${s.err ? " err" : s.cached ? " cache" : ""}`} style={{ ["--i" as string]: Math.round(logX(s.total!) * 40) }} />
        ))}
      </svg>
    </div>
  );
}

/** A typical answer laid out like a trace: waiting for the first byte, then streaming, at p50 (solid) with the p95
 *  reach behind it (ghost). */
export function Anatomy({ ttfb, total }: { ttfb: [number | null, number | null]; total: [number | null, number | null] }) {
  const max = Math.max(1, total[1] ?? 0, total[0] ?? 0, ttfb[1] ?? 0);
  const pc = (v: number | null) => `${((v ?? 0) / max) * 100}%`;
  const rows: [string, number | null, number | null, number | null, number | null][] = [
    ["first byte", 0, ttfb[0], 0, ttfb[1]],
    ["streaming", ttfb[0], total[0], ttfb[1], total[1]],
  ];
  return (
    <ol className="d-anat" aria-label={`Typical answer: first byte ${fmtMs(ttfb[0])} (p95 ${fmtMs(ttfb[1])}), complete ${fmtMs(total[0])} (p95 ${fmtMs(total[1])})`}>
      {rows.map(([name, a, b, ga, gb], i) => (
        <li key={name}>
          <span className="n">{name}</span>
          <span className="track">
            <i className="ghost" style={{ left: pc(ga), width: `calc(${pc(gb)} - ${pc(ga)})` }} />
            <i className={`bar k${i}`} style={{ left: pc(a), width: `calc(${pc(b)} - ${pc(a)})`, ["--i" as string]: i }} />
          </span>
          <span className="v">{fmtMs(b)}<small>p95 {fmtMs(gb)}</small></span>
        </li>
      ))}
    </ol>
  );
}

/** A conversation's glyph strip: question (pink dot), tool call (amber diamond), answer (tick; hollow from cache),
 *  failed answer (red cross), placed along its own duration. */
export function GlyphStrip({ marks, label }: { marks: StripMark[]; label: string }) {
  const W = 160, H = 22, m = H / 2;
  const x = (o: number) => f1(8 + o * (W - 16));
  return (
    <svg className="d-strip" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <line x1={8} x2={W - 8} y1={m} y2={m} className="d-strip-base" />
      {marks.map((k, i) => {
        const cx = x(k.o);
        if (k.k === "u") return <circle key={i} cx={cx} cy={m} r={3.6} className="g-u" />;
        if (k.k === "t") return <rect key={i} x={cx - 2.8} y={m - 2.8} width={5.6} height={5.6} transform={`rotate(45 ${cx} ${m})`} className="g-t" />;
        if (k.k === "e") return <path key={i} d={`M${cx - 3} ${m - 3}L${cx + 3} ${m + 3}M${cx + 3} ${m - 3}L${cx - 3} ${m + 3}`} className="g-e" />;
        return <rect key={i} x={cx - 1.4} y={m - 6} width={2.8} height={12} rx={1.4} className={k.c ? "g-a c" : "g-a"} />;
      })}
    </svg>
  );
}

/** Counts of `times` per UTC day over the last `n` days as small bars (today on the right). */
export function Hist({ times, now, n = 30, tone, label }: { times: string[]; now: number; n?: number; tone?: "amber"; label: string }) {
  const days = Array<number>(n).fill(0), today = Math.floor(now / 86_400_000);
  for (const t of times) { const i = n - 1 - (today - Math.floor(Date.parse(t) / 86_400_000)); if (i >= 0 && i < n) days[i] += 1; }
  const max = Math.max(1, ...days);
  return (
    <span className={`d-hist${tone ? ` ${tone}` : ""}`} role="img" aria-label={label}>
      {days.map((v, i) => <i key={i} className={v ? undefined : "z"} style={{ height: v ? `${Math.max(8, (v / max) * 100)}%` : undefined, ["--i" as string]: i }} />)}
    </span>
  );
}

/** The last 30 days as a row of cells, brighter for more visits that day (today on the right). */
export function DayCells({ days }: { days: number[] }) {
  const max = Math.max(1, ...days);
  return (
    <span className="d-cells" role="img" aria-label={`${days.reduce((a, b) => a + b, 0)} visits in the last 30 days`}>
      {days.map((v, i) => <i key={i} style={v ? { opacity: 0.3 + 0.7 * (v / max) } : undefined} className={v ? "on" : undefined} />)}
    </span>
  );
}

/** A metric against good / needs-work / poor bands (Web Vitals thresholds), with a marker at the value. */
export function Threshold({ name, value, good, poor, fmt }: { name: string; value: number | null; good: number; poor: number; fmt: (v: number | null) => string }) {
  const max = poor * 1.5;
  const at = value === null ? null : Math.min(1, value / max);
  const tone = value === null ? "" : value <= good ? "good" : value <= poor ? "warn" : "bad";
  return (
    <div className={`d-thr ${tone}`}>
      <div className="d-thr-h"><span>{name}</span><b>{fmt(value)}</b></div>
      <div className="d-thr-bar" aria-hidden="true">
        <i style={{ width: `${(good / max) * 100}%` }} className="g" />
        <i style={{ width: `${((poor - good) / max) * 100}%` }} className="w" />
        <i style={{ flex: 1 }} className="b" />
        {at !== null && <em style={{ left: `${at * 100}%` }} />}
      </div>
    </div>
  );
}

const PATHS: Record<string, string> = {
  ask: "M4 4l5 4-5 4",
  mail: "M2.5 4.5h11v7h-11zM2.5 4.5l5.5 4 5.5-4",
  resume: "M4 2.5h5l3 3v8H4zM9 2.5v3h3M6 9h4M6 11.5h4",
  id: "M8 8.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8zM3.5 13.5c.6-2.4 2.3-3.6 4.5-3.6s3.9 1.2 4.5 3.6",
  out: "M6 3.5h6.5V10M12.5 3.5L4 12",
  case: "M3 3h10v10H3zM3 6.5h10",
  design: "M8 2.5a5.5 5.5 0 1 0 0 11zM8 2.5a5.5 5.5 0 0 1 0 11",
  desktop: "M2.5 3.5h11v7.5h-11zM6 13.5h4M8 11v2.5",
  mobile: "M5 1.8h6v12.4H5zM7.2 12.3h1.6",
  tablet: "M3 2.5h10v11H3zM7.3 11.8h1.4",
  flag: "M4 14V2.5M4 3h7.5l-1.6 2.6L11.5 8H4",
  share: "M5.5 8.5l5-3M5.5 7.5l5 3M4 9.8a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6zM12 6a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 12 6zM12 13.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z",
};

/** A 16px line icon in currentColor (decorative unless `label`). */
export function Ico({ name, label }: { name: keyof typeof PATHS | string; label?: string }) {
  return (
    <svg className="d-ico" viewBox="0 0 16 16" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={PATHS[name] ?? PATHS.case} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
