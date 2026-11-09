/** The /admin overview: summary, traffic, audience, engagement, agent, outreach and system, for one period.
 *  Server-rendered from one Dashboard object (lib/analytics/server.ts or the lab fixture); only the charts, the globe
 *  and the AI button are client islands. `base` prefixes every link so the lab harness stays self-contained. */
import CartesianChart from "@/components/site/charts/CartesianChart";
import { Sparkline, UptimeStrip } from "@/components/site/charts/Figures";
import { delta, PERIOD_LABEL } from "@/lib/analytics/shape";
import type { Dashboard as D } from "@/lib/analytics/types";
import { fmtInt, fmtMs, fmtRate, fmtUptime, fmtUsd, healthState } from "@/lib/status/format";
import { duration } from "@/lib/track/views";
import AiSummary from "./AiSummary";
import Globe from "./Globe";
import { ago, Card, Delta, Empty, initials, RankBars, Section, Split } from "./ui";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Axis label for a bucket start: "14:00" for hours, "Nov 3" for days (UTC). */
const tick = (iso: string, hour: boolean) => { const d = new Date(iso); return hour ? `${String(d.getUTCHours()).padStart(2, "0")}:00` : `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const NET: Record<string, string> = { isp: "ISP / home", business: "Business", edu: "University", hosting: "Hosting / VPN", unknown: "Unknown" };
const rate = (n: number, d: number) => (d > 0 ? n / d : null);

export default function Dashboard({ d, base = "/admin", write, sample }: { d: D; base?: string; write?: () => Promise<{ text?: string; error?: string }>; sample?: string }) {
  const k = d.kpis, p = d.prev;
  const hour = d.bucket === "hour";
  const now = Date.parse(d.generatedAt);
  const span = PERIOD_LABEL[d.period].toLowerCase();
  const labels = d.series.map((s) => tick(s.t, hour));
  const bounce = rate(k.bounces, k.visits), prevBounce = p ? rate(p.bounces, p.visits) : null;
  const tiles: { l: string; v: string; d: number | null; up?: boolean; note?: string; spark?: number[] }[] = [
    { l: "Visits", v: fmtInt(k.visits), d: delta(k.visits, p?.visits), spark: d.series.map((s) => s.visits) },
    { l: "People", v: fmtInt(k.visitors), d: delta(k.visitors, p?.visitors), spark: d.series.map((s) => s.visitors) },
    { l: "Returning", v: fmtRate(rate(k.returning, k.visitors)), d: null, note: `${fmtInt(k.returning)} came back` },
    { l: "Avg. active time", v: k.avgActiveMs === null ? "–" : duration(k.avgActiveMs), d: delta(k.avgActiveMs ?? 0, p?.avgActiveMs), note: "per visit, tab in focus" },
    { l: "Bounce rate", v: fmtRate(bounce), d: bounce !== null && prevBounce ? (bounce - prevBounce) / prevBounce : null, up: false, note: "left without doing anything" },
    { l: "Identified", v: fmtInt(k.identified), d: delta(k.identified, p?.identified), note: "gave an email" },
    { l: "Meeting requests", v: fmtInt(k.meetings), d: delta(k.meetings, p?.meetings), note: "through the agent" },
    { l: "Emails sent", v: fmtInt(k.emails), d: delta(k.emails, p?.emails), note: `${fmtInt(k.chats)} agent conversations` },
  ];
  const r = d.rag;
  const most = d.features.filter((f) => f.visitors > 0).slice(0, 12);
  const least = [...d.features].reverse().slice(0, 10);
  const health = healthState(d.system.uptime.recent);
  const pctUp = (f: number | null) => fmtUptime(f === null ? null : f * 100);
  const totalVisitors = d.countries.reduce((s, c) => s + c.value, 0);

  return (
    <main className="adm-main">
      <Section id="summary" eyebrow={`How it's going · ${PERIOD_LABEL[d.period]}`} title="Summary">
        <div className="adm-hero">
          <h1>{d.headline}</h1>
          <ul className="adm-kpis">
            {tiles.map((t) => (
              <li key={t.l} className="adm-kpi">
                <span className="l">{t.l}</span>
                <span className="v">{t.v}</span>
                <span className="n"><Delta d={t.d} goodUp={t.up !== false} />{t.note}{!t.note && p && <span>vs previous {span}</span>}</span>
                {t.spark && t.spark.length > 1 && <div className="sp"><Sparkline values={t.spark} label={`${t.l} over the ${span}`} height={30} /></div>}
              </li>
            ))}
          </ul>
          <AiSummary write={write} sample={sample} />
        </div>
      </Section>

      <Section id="traffic" eyebrow="Traffic" title="Visits over time" note={`Bots excluded. ${hour ? "Hourly" : "Daily"} buckets, UTC.`}>
        <div className="adm-grid">
          <Card span={8} title="Visits and people" note={`${fmtInt(k.visits)} visits · ${fmtInt(k.visitors)} people`}>
            {k.visits ? (
              <CartesianChart kind="area" upright title={`Visits and people per ${hour ? "hour" : "day"}, ${span}`} labels={labels}
                series={[{ name: "Visits", values: d.series.map((s) => s.visits) }, { name: "People", values: d.series.map((s) => s.visitors) }]} height={240} />
            ) : <Empty title="No visits yet">Each page session appears here as it starts.</Empty>}
          </Card>
          <Card span={4} title="Entry pages" note="where visits start">
            <RankBars rows={d.entries} max={8} empty="Entry pages appear once someone visits." total={k.visits} />
          </Card>
          <Card span={4} title="Sections seen" note="visits that reached each, with typical dwell">
            <RankBars rows={d.sections.map((s) => ({ label: s.label, value: s.value, sub: s.dwell ? `~${duration(s.dwell * 1000)}` : undefined }))} max={9} empty="Sections are logged as they scroll into view." />
          </Card>
          <Card span={4} title="Scroll depth" note="visits reaching each mark">
            {d.scroll.some((s) => s.visits) ? (
              <div className="adm-funnel" role="img" aria-label={d.scroll.map((s) => `${s.pct}%: ${s.visits} visits`).join(", ")}>
                {d.scroll.map((s) => {
                  const top = Math.max(1, d.scroll[0].visits, k.visits);
                  return <div key={s.pct}><b>{fmtRate(s.visits / top)}</b><i style={{ height: `${Math.max(2, (s.visits / top) * 100)}%` }} /><span>{s.pct}%</span></div>;
                })}
              </div>
            ) : <Empty>Scroll marks (25/50/75/100%) appear as people read down the page.</Empty>}
          </Card>
          <Card span={4} title="Referrers" note="external sources; direct = no referrer">
            <RankBars rows={d.referrers} max={8} total={k.visits} empty="Referrers appear once someone arrives from a link." />
          </Card>
        </div>
      </Section>

      <Section id="audience" eyebrow="Audience" title="Where people come from" note="Locations from the visitor's IP; companies from the network owner or what they told the agent.">
        <div className="adm-grid">
          <Card span={12} title="Visitor map" note={`${fmtInt(totalVisitors)} people in ${fmtInt(d.countries.length)} countries`}>
            {d.points.length ? (
              <div className="adm-geo">
                <Globe points={d.points} label={`Globe of visitor locations: ${d.points.slice(0, 5).map((x) => `${x.label} ${x.value}`).join(", ")}`} />
                <div style={{ display: "grid", gap: 18 }}>
                  <div><h3 className="adm-eyebrow" style={{ margin: "0 0 12px" }}>Countries</h3><RankBars rows={d.countries} max={8} total={totalVisitors} /></div>
                  <div><h3 className="adm-eyebrow" style={{ margin: "0 0 12px" }}>Top places</h3><RankBars rows={d.points.map((x) => ({ label: x.label, value: x.value }))} max={6} /></div>
                </div>
              </div>
            ) : <Empty title="No locations yet">The globe fills in as visitors arrive; each dot is a city, sized by how many people came from it.</Empty>}
          </Card>
          <Card span={4} title="Organisations" note="companies and universities">
            <Split rows={d.ipTypes.map((t) => ({ ...t, label: NET[t.label] ?? t.label }))} empty="Network types appear once IPs are looked up." />
            <div style={{ height: 16 }} />
            <RankBars rows={d.orgs} max={8} empty="No company or university networks yet. ISP and hosting networks say nothing about an employer, so they are left out." />
          </Card>
          <Card span={4} title="Devices">
            <div style={{ display: "grid", gap: 18 }}>
              <div><h3 className="adm-eyebrow" style={{ margin: "0 0 10px" }}>Device</h3><Split rows={d.devices} /></div>
              <div><h3 className="adm-eyebrow" style={{ margin: "0 0 10px" }}>Browser</h3><Split rows={d.browsers} /></div>
              <div><h3 className="adm-eyebrow" style={{ margin: "0 0 10px" }}>OS</h3><Split rows={d.os} /></div>
            </div>
          </Card>
          <Card span={4} title="Campaigns and networks" note="UTM tags; network owners">
            <RankBars rows={d.campaigns} max={5} empty="No UTM-tagged links used yet. Add ?utm_source=… to links you share to see them here." />
            <div style={{ height: 16 }} />
            <RankBars rows={d.networks} max={6} empty="Networks appear once IPs are looked up." />
          </Card>
        </div>
      </Section>

      <Section id="engagement" eyebrow="Engagement" title="What people do" note="Ranked by how many people used each feature (uses in the bar label).">
        <div className="adm-grid">
          <Card span={7} title="Most used">
            <RankBars rows={most.map((f) => ({ label: f.label, value: f.visitors, sub: `${f.group} · ${fmtInt(f.uses)} uses` }))} max={12} unit=" people" empty="Feature use appears here: agent questions, design switches, resume opens, games, emails." />
          </Card>
          <Card span={5} title="Least used" note="including features nobody touched">
            <RankBars rows={least.map((f) => ({ label: f.label, value: f.visitors, sub: f.group }))} max={10} unit=" people" />
          </Card>
        </div>
      </Section>

      <Section id="agent" eyebrow="Agent" title="RAG conversations" note="Owner chats excluded.">
        <div className="adm-grid">
          <Card span={12}>
            <ul className="adm-stats">
              {[
                ["Conversations", fmtInt(r.conversations), `${fmtInt(r.chatters)} people`],
                ["Questions", fmtInt(r.turns), r.conversations ? `${(r.turns / r.conversations).toFixed(1)} per conversation` : "–"],
                ["Cache hit rate", fmtRate(rate(r.cached, r.answers)), `${fmtInt(r.cached)} from cache`],
                ["First byte", fmtMs(r.ttfbP50), `p50 · p95 ${fmtMs(r.ttfbP95)}`],
                ["Full answer", fmtMs(r.totalP50), `p50 · p95 ${fmtMs(r.totalP95)}`],
                ["Tokens", fmtInt(r.tokens), `est. ${fmtUsd(r.costUsd)}`],
                ["Declined", fmtInt(r.declines), fmtRate(rate(r.declines, r.answers))],
                ["Errors", fmtInt(r.errors), fmtRate(rate(r.errors, r.answers))],
              ].map(([l, v, n]) => <li key={l} className="adm-stat"><span className="l">{l}</span><span className="v">{v}</span><span className="n">{n}</span></li>)}
            </ul>
            {r.turns ? (
              <CartesianChart kind="bar" upright title={`Questions per ${hour ? "hour" : "day"}, ${span}`} labels={r.series.map((s) => tick(s.t, hour))} series={[{ name: "Questions", values: r.series.map((s) => s.turns) }]} height={170} />
            ) : <Empty title="No conversations yet">Questions, answers, tools and timings appear as soon as someone talks to the agent.</Empty>}
          </Card>
          <Card span={8} title="Top questions" note="grouped across rewordings">
            {r.questions.length ? (
              <div className="adm-scroll"><table className="adm-table">
                <thead><tr><th>Question</th><th className="num">Asked</th><th className="num">Declined</th><th><span className="sr-only">Open</span></th></tr></thead>
                <tbody>{r.questions.map((q) => (
                  <tr key={q.text}><td>{q.text}</td><td className="num">{q.count}</td><td className="num">{q.declined || "–"}</td>
                    <td>{q.sid && <a className="adm-btn sm" href={`${base}/chats/${q.sid}`}>Open</a>}</td></tr>
                ))}</tbody>
              </table></div>
            ) : <Empty>The most-asked questions appear here, clustered so rewordings count together.</Empty>}
          </Card>
          <Card span={4} title="Tools and models">
            <RankBars rows={r.tools} max={8} empty="Tool calls (search, calendar, meeting, resume…) appear here." />
            <div style={{ height: 16 }} />
            <RankBars rows={r.models.map((m) => ({ label: m.model, value: m.requests, sub: `${fmtInt(m.tokens)} tok` }))} max={4} empty="No answers yet." />
          </Card>
        </div>
      </Section>

      <Section id="outreach" eyebrow="Outreach" title="Worth following up" note="Scored from what each visitor did; every point is listed. Nothing is ever sent automatically.">
        {d.leads.length ? (
          <ul className="adm-leads">
            {d.leads.slice(0, 12).map((l) => (
              <li key={l.id} className="adm-lead">
                <div className="adm-lead-h">
                  <span className="adm-avatar" aria-hidden="true">{initials(l.who)}</span>
                  <span className="who"><b>{l.who}</b><span>{[l.company && l.company !== l.who ? l.company : null, l.place].filter(Boolean).join(" · ")}</span></span>
                  <span className={`adm-tier ${l.tier}`}>{l.tier}</span>
                </div>
                <div className="adm-score" aria-label={`Score ${l.score} of 100`}><b>{l.score}</b><span><i style={{ ["--w" as string]: `${l.score}%` }} /></span></div>
                <div className="adm-chips">{l.signals.map((s) => <span key={s} className="adm-chip">{s}</span>)}</div>
                <div className="adm-acts">
                  <a className="adm-btn sm" href={`${base}/visitors/${l.id}`}>Open visitor</a>
                  {l.lastChat && <a className="adm-btn sm" href={`${base}/chats/${l.lastChat}`}>Open chat</a>}
                  {l.email && <a className="adm-btn sm" href={`mailto:${l.email}`}>Email</a>}
                  <span className="adm-muted" style={{ marginLeft: "auto", fontSize: 12, alignSelf: "center" }}>{ago(l.lastSeen, now)}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty title="No one to follow up yet">Visitors who request a meeting, send an email, download the resume, return or stay a while are ranked here.</Empty>}
      </Section>

      <Section id="system" eyebrow="System" title="Health">
        <div className="adm-grid">
          <Card span={6} title="Uptime" action={<span className={`adm-health ${health.tone}`}>{health.text}</span>}>
            <ul className="adm-stats">
              {(["24h", "7d", "30d"] as const).map((x) => <li key={x} className="adm-stat"><span className="l">Last {x}</span><span className="v">{pctUp(d.system.uptime[x])}</span></li>)}
            </ul>
            {d.system.uptime.recent.length ? <UptimeStrip checks={d.system.uptime.recent} /> : <Empty>Health checks appear once the uptime job runs (every five minutes).</Empty>}
          </Card>
          <Card span={3} title="Web vitals" note={`p75 over ${fmtInt(d.system.vitals.n)} visits`}>
            <dl className="adm-kv">
              <div><dt>LCP</dt><dd>{fmtMs(d.system.vitals.lcp)}</dd></div>
              <div><dt>INP</dt><dd>{fmtMs(d.system.vitals.inp)}</dd></div>
              <div><dt>CLS</dt><dd>{d.system.vitals.cls === null ? "–" : d.system.vitals.cls.toFixed(3)}</dd></div>
            </dl>
          </Card>
          <Card span={3} title="Build">
            <dl className="adm-kv">
              <div><dt>Commit</dt><dd>{d.system.commit ?? "local"}</dd></div>
              <div><dt>Answer model</dt><dd>{d.system.model}</dd></div>
              <div><dt>Helper model</dt><dd>{d.system.auxModel}</dd></div>
            </dl>
          </Card>
          <Card span={12} title="Browser errors" note="JavaScript errors visitors hit, grouped by message">
            <RankBars rows={d.system.jsErrors} max={6} empty="No JavaScript errors reported in this period." />
          </Card>
        </div>
      </Section>
    </main>
  );
}
