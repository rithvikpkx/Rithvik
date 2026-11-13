/** The /admin overview for one period: a hero (headline, four numbers, the day ring), then Traffic, Audience, Agent,
 *  Engagement, Outreach and System, one idea per panel. Server-rendered from one Dashboard object (lib/analytics/server.ts
 *  or the lab fixture); the pulse chart, globe, counting numbers and AI read are the only client islands. `base`
 *  prefixes every link so the lab harness stays self-contained. */
import type { CSSProperties } from "react";
import { UptimeStrip } from "@/components/site/charts/Figures";
import { delta, PERIOD_LABEL } from "@/lib/analytics/shape";
import type { Dashboard as D } from "@/lib/analytics/types";
import { fmtInt, fmtMs, fmtRate, fmtUptime, fmtUsd, healthState } from "@/lib/status/format";
import AiSummary from "./AiSummary";
import Globe from "./Globe";
import { Num } from "./live";
import Pulse from "./Pulse";
import { ago, Delta, Empty, Panel, Ranks, Section, Split } from "./ui";
import { Anatomy, DayRing, Ico, Journey, Sigil, Swarm, Threshold } from "./viz";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Axis label for a bucket start: "14:00" for hours, "Nov 3" for days (UTC). */
const tick = (iso: string, hour: boolean) => { const d = new Date(iso); return hour ? `${String(d.getUTCHours()).padStart(2, "0")}:00` : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const NET: Record<string, string> = { isp: "home / isp", business: "business", edu: "university", hosting: "hosting / vpn", unknown: "unknown" };
const rate = (n: number, d: number) => (d > 0 ? n / d : null);
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default function Dashboard({ d, base = "/admin", write, sample }: { d: D; base?: string; write?: () => Promise<{ text?: string; error?: string }>; sample?: string }) {
  const k = d.kpis, p = d.prev, r = d.rag;
  const hour = d.bucket === "hour";
  const now = Date.parse(d.generatedAt);
  const span = PERIOD_LABEL[d.period].toLowerCase();
  const labels = d.series.map((s) => tick(s.t, hour));
  const bounce = rate(k.bounces, k.visits), prevBounce = p ? rate(p.bounces, p.visits) : null;
  const peak = d.rhythm.indexOf(Math.max(...d.rhythm));
  const totalVisitors = d.countries.reduce((s, c) => s + c.value, 0);
  const used = d.features.filter((f) => f.visitors > 0).slice(0, 10);
  const untouched = d.features.filter((f) => f.visitors === 0);
  const health = healthState(d.system.uptime.recent);
  const pctUp = (f: number | null) => fmtUptime(f === null ? null : f * 100);
  const big: { l: string; v: number | null; kind: "int" | "dur"; d: number | null }[] = [
    { l: "visits", v: k.visits, kind: "int", d: delta(k.visits, p?.visits) },
    { l: "people", v: k.visitors, kind: "int", d: delta(k.visitors, p?.visitors) },
    { l: "active / visit", v: k.avgActiveMs, kind: "dur", d: delta(k.avgActiveMs ?? 0, p?.avgActiveMs) },
    { l: "identified", v: k.identified, kind: "int", d: delta(k.identified, p?.identified) },
  ];
  const small: [string, string, number | null, boolean?][] = [
    ["returning", fmtRate(rate(k.returning, k.visitors)), null],
    ["bounce", fmtRate(bounce), bounce !== null && prevBounce ? (bounce - prevBounce) / prevBounce : null, false],
    ["meetings", fmtInt(k.meetings), delta(k.meetings, p?.meetings)],
    ["emails", fmtInt(k.emails), delta(k.emails, p?.emails)],
  ];

  return (
    <main className="d-main">
      <section className="d-hero" aria-label={`Summary, ${span}`}>
        <div className="d-hero-l">
          <p className="d-kicker">{span}</p>
          <h1>{d.headline}</h1>
          <ul className="d-big">
            {big.map((t, i) => (
              <li key={t.l} style={{ ["--i" as string]: i } as CSSProperties}>
                <span className="v"><Num value={t.v} kind={t.kind} /></span>
                <span className="l">{t.l}<Delta d={t.d} /></span>
              </li>
            ))}
          </ul>
          <ul className="d-small">
            {small.map(([l, v, dd, up]) => <li key={l}><span>{l}</span><b>{v}</b><Delta d={dd} goodUp={up !== false} /></li>)}
          </ul>
        </div>
        <DayRing values={d.rhythm} labels={["00", "06", "12", "18"]} now={d.period === "24h" ? new Date(now).getUTCHours() : undefined}
          label={`Visits by hour of day (UTC), ${span}. Busiest hour ${hh(peak)}.`}>
          {d.rhythm.some(Boolean) ? <>busiest <b>{hh(peak)}</b> utc</> : "no visits yet"}
        </DayRing>
      </section>

      <AiSummary write={write} sample={sample} />

      <Section id="traffic" n="01" title="Traffic" meta={`${hour ? "hourly" : "daily"} · utc · bots excluded`}>
        <div className="d-grid">
          <Panel label="visits and people" aside={<span className="d-legend"><i className="s0" />visits<i className="s1" />people</span>} i={0}>
            {k.visits ? <Pulse title={`Visits and people per ${hour ? "hour" : "day"}, ${span}`} labels={labels}
              series={[{ name: "visits", values: d.series.map((s) => s.visits) }, { name: "people", values: d.series.map((s) => s.visitors) }]} height={230} />
              : <Empty>Each page session appears here as it starts.</Empty>}
          </Panel>
          <Panel label="how far they read" span={8} i={1} aside={<span className="d-scroll">{d.scroll.map((s) => <span key={s.pct}>{s.pct}%<b>{fmtRate(s.visits / Math.max(1, k.visits))}</b></span>)}</span>}>
            {d.sections.length ? <Journey sections={d.sections} total={k.visits} /> : <Empty>Sections are logged as they scroll into view.</Empty>}
          </Panel>
          <Panel label="sources" span={4} i={2}>
            <Ranks rows={d.referrers} max={6} total={k.visits} logos empty="Referrers appear once someone arrives from a link." />
            <h4 className="d-sub">landed on</h4>
            <Ranks rows={d.entries} max={4} total={k.visits} tone="sky" empty="Entry pages appear once someone visits." />
          </Panel>
        </div>
      </Section>

      <Section id="audience" n="02" title="Audience" meta={`${fmtInt(totalVisitors)} people · ${fmtInt(d.countries.length)} countries`}>
        <div className="d-grid">
          <Panel label="where" span={7} className="d-geo" i={0}>
            {d.points.length
              ? <Globe points={d.points} label={`Globe of visitor locations: ${d.points.slice(0, 5).map((x) => `${x.label} ${x.value}`).join(", ")}`} />
              : <Empty>The globe fills in as visitors arrive; each dot is a city, sized by how many came from it.</Empty>}
          </Panel>
          <Panel label="countries" span={5} i={1}>
            <Ranks rows={d.countries} max={7} total={totalVisitors} />
            <h4 className="d-sub">cities</h4>
            <Ranks rows={d.points.map((x) => ({ label: x.label, value: x.value }))} max={4} tone="sky" />
          </Panel>
          <Panel label="organisations" span={4} i={2}>
            <Split rows={d.ipTypes.map((t) => ({ ...t, label: NET[t.label] ?? t.label }))} empty="Network types appear once IPs are looked up." />
            <div className="d-gap" />
            <Ranks rows={d.orgs} max={6} tone="sky" empty="No company or university networks yet." />
          </Panel>
          <Panel label="devices" span={4} i={3}>
            <ul className="d-devices">
              {d.devices.slice(0, 3).map((x) => (
                <li key={x.label}><Ico name={x.label} /><b>{fmtRate(rate(x.value, d.devices.reduce((s, y) => s + y.value, 0)))}</b><span>{x.label}</span></li>
              ))}
            </ul>
            <Split rows={d.browsers} />
            <div className="d-gap" />
            <Split rows={d.os} />
          </Panel>
          <Panel label="campaigns" span={4} i={4}>
            <Ranks rows={d.campaigns} max={5} empty="No UTM-tagged links yet. Add ?utm_source=… to links you share." />
            <h4 className="d-sub">networks</h4>
            <Ranks rows={d.networks} max={4} tone="sky" empty="Networks appear once IPs are looked up." />
          </Panel>
        </div>
      </Section>

      <Section id="agent" n="03" title="Agent" meta="owner chats excluded">
        <ul className="d-stats">
          <li><b><Num value={r.conversations} /></b><span>conversations</span><small>{fmtInt(r.chatters)} people</small></li>
          <li><b><Num value={r.turns} /></b><span>questions</span><small>{r.conversations ? `${(r.turns / r.conversations).toFixed(1)} each` : "–"}</small></li>
          <li><b><Num value={rate(r.cached, r.answers)} kind="pct" /></b><span>from cache</span><small>{fmtInt(r.cached)} answers</small></li>
          <li><b><Num value={r.tokens} /></b><span>tokens</span><small>{fmtUsd(r.costUsd)}</small></li>
        </ul>
        <div className="d-grid">
          <Panel label="every answer, by time to finish" span={8} i={0} aside={<span className="d-legend"><i className="dot" />answer<i className="dot cache" />cache<i className="dot err" />failed</span>}>
            {r.samples.length ? <Swarm samples={r.samples} p50={r.totalP50} p95={r.totalP95} /> : <Empty>Each answer becomes a dot here, placed by how long it took.</Empty>}
          </Panel>
          <Panel label="a typical answer" span={4} i={1}>
            <Anatomy ttfb={[r.ttfbP50, r.ttfbP95]} total={[r.totalP50, r.totalP95]} />
            <ul className="d-pair">
              <li><b>{fmtInt(r.declines)}</b>declined<small>{fmtRate(rate(r.declines, r.answers))}</small></li>
              <li className={r.errors ? "bad" : undefined}><b>{fmtInt(r.errors)}</b>failed<small>{fmtRate(rate(r.errors, r.answers))}</small></li>
            </ul>
          </Panel>
          <Panel label="questions" span={7} i={2} aside={`per ${hour ? "hour" : "day"}`}>
            {r.turns ? <Pulse tone="amber" title={`Questions per ${hour ? "hour" : "day"}, ${span}`} labels={r.series.map((s) => tick(s.t, hour))} series={[{ name: "questions", values: r.series.map((s) => s.turns) }]} height={120} /> : null}
            {r.questions.length ? (
              <ol className="d-prompts">
                {r.questions.slice(0, 7).map((q) => {
                  const body = <><span className="c" aria-hidden="true">❯</span><span className="q">{q.text}</span><span className="n">×{q.count}{q.declined ? <em>{q.declined} declined</em> : null}</span></>;
                  return <li key={q.text}>{q.sid ? <a href={`${base}/chats/${q.sid}`}>{body}</a> : <div>{body}</div>}</li>;
                })}
              </ol>
            ) : <Empty>The most-asked questions appear here, rewordings counted together.</Empty>}
          </Panel>
          <Panel label="tools" span={5} i={3}>
            {r.tools.length ? (
              <ol className="d-tools">
                {r.tools.slice(0, 7).map((t, i) => (
                  <li key={t.label} style={{ ["--w" as string]: `${(t.value / Math.max(1, r.tools[0].value)) * 100}%`, ["--i" as string]: i } as CSSProperties}>
                    <span aria-hidden="true">⏺</span><code>{t.label}</code><b>{fmtInt(t.value)}</b>
                  </li>
                ))}
              </ol>
            ) : <Empty>Tool calls appear here.</Empty>}
            <h4 className="d-sub">models</h4>
            <Ranks rows={r.models.map((m) => ({ label: m.model, value: m.requests, sub: `${fmtInt(m.tokens)} tok` }))} max={3} tone="amber" empty="No answers yet." />
          </Panel>
        </div>
      </Section>

      <Section id="engagement" n="04" title="Engagement" meta="people who used each feature">
        <div className="d-grid">
          <Panel label="most used" span={8} i={0}>
            <Ranks rows={used.map((f) => ({ label: f.label, value: f.visitors, sub: f.group.toLowerCase() }))} max={10} empty="Feature use appears here." />
          </Panel>
          <Panel label="untouched" span={4} i={1} aside={fmtInt(untouched.length)}>
            {untouched.length ? <ul className="d-ghosts">{untouched.map((f) => <li key={f.key}>{f.label}</li>)}</ul> : <Empty>Every feature was used at least once.</Empty>}
          </Panel>
        </div>
      </Section>

      <Section id="outreach" n="05" title="Outreach" meta="scored from what each visitor did · nothing is sent automatically">
        {d.leads.length ? (
          <ul className="d-leads">
            {d.leads.slice(0, 9).map((l, i) => (
              <li key={l.id} className={`d-lead ${l.tier}`} style={{ ["--i" as string]: i } as CSSProperties}>
                <a className="d-lead-h" href={`${base}/visitors/${l.id}`}>
                  <Sigil id={l.id} size={40} />
                  <span className="who"><b>{l.who}</b><span>{[l.company && l.company !== l.who ? l.company : null, l.place].filter(Boolean).join(" · ")}</span></span>
                  <span className="d-score" style={{ ["--s" as string]: l.score } as CSSProperties} aria-label={`Score ${l.score} of 100, ${l.tier}`}><b>{l.score}</b></span>
                </a>
                <div className="d-chips">{l.signals.slice(0, 5).map((s) => <span key={s} className="d-chip">{s}</span>)}{l.signals.length > 5 && <span className="d-chip dim">+{l.signals.length - 5}</span>}</div>
                <div className="d-acts">
                  {l.lastChat && <a href={`${base}/chats/${l.lastChat}`}>chat</a>}
                  {l.email && <a href={`mailto:${l.email}`}>email</a>}
                  <span>{ago(l.lastSeen, now)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>Visitors who request a meeting, send an email, download the resume, return or stay a while are ranked here.</Empty>}
      </Section>

      <Section id="system" n="06" title="System" meta={<span className={`d-health ${health.tone}`}>{health.text.toLowerCase()}</span>}>
        <div className="d-grid">
          <Panel label="uptime" span={8} i={0} aside={<span className="d-uptimes">{(["24h", "7d", "30d"] as const).map((x) => <span key={x}>{x}<b>{pctUp(d.system.uptime[x])}</b></span>)}</span>}>
            {d.system.uptime.recent.length ? <UptimeStrip checks={d.system.uptime.recent} /> : <Empty>Health checks appear once the uptime job runs (every five minutes).</Empty>}
          </Panel>
          <Panel label={`web vitals · p75 · ${fmtInt(d.system.vitals.n)} visits`} span={4} i={1}>
            <Threshold name="LCP" value={d.system.vitals.lcp} good={2500} poor={4000} fmt={fmtMs} />
            <Threshold name="INP" value={d.system.vitals.inp} good={200} poor={500} fmt={fmtMs} />
            <Threshold name="CLS" value={d.system.vitals.cls} good={0.1} poor={0.25} fmt={(v) => (v === null ? "–" : v.toFixed(3))} />
          </Panel>
          <Panel label="browser errors" span={8} i={2}>
            <Ranks rows={d.system.jsErrors} max={5} tone="amber" empty="No JavaScript errors in this period." />
          </Panel>
          <Panel label="build" span={4} i={3}>
            <dl className="d-kv">
              <div><dt>commit</dt><dd>{d.system.commit ?? "local"}</dd></div>
              <div><dt>answers</dt><dd>{d.system.model}</dd></div>
              <div><dt>helper</dt><dd>{d.system.auxModel}</dd></div>
            </dl>
          </Panel>
        </div>
      </Section>
    </main>
  );
}
