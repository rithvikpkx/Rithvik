import type { Metadata } from "next";
import Link from "next/link";
import "@/components/admin/admin.css";
import "@/components/site/charts/charts.css";
import "./status.css";
import CartesianChart from "@/components/site/charts/CartesianChart";
import { UptimeStrip } from "@/components/site/charts/Figures";
import Globe from "@/components/admin/Globe";
import { Card, Empty, RankBars, Section } from "@/components/admin/ui";
import { centroid } from "@/lib/analytics/geo";
import { lookCss, lookFor } from "@/lib/analytics/look";
import { getLook, getPalettes } from "@/lib/designs/server";
import { bucketLabel, fmtInt, fmtMs, fmtRate, fmtStamp, fmtUptime, fmtUsd, healthState } from "@/lib/status/format";
import { loadStatus, loadTraffic } from "@/lib/status/load";

export const metadata: Metadata = {
  title: "Status",
  description: "Live uptime, visitors, response times, errors and cost for rithvik.ai and its chat agent.",
  alternates: { canonical: "/status" },
};

/** /status: the public, condensed version of the admin dashboard. Counts and timings only: no IPs, organisations,
 *  emails, questions or cities, and countries with fewer than three visitors are grouped as "other". Wears the
 *  visitor's active look. Server-rendered; the 24h / 7d switch is a link, so the page needs no JS beyond chart hover. */
export default async function StatusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const range = (await searchParams).range === "7d" ? "7d" : "24h";
  const palettes = await getPalettes();
  const [data, traffic, lookId] = await Promise.all([loadStatus(), loadTraffic(), getLook(palettes)]);
  const look = lookFor(lookId, palettes);
  const state = data ? healthState(data.uptime.recent) : null;
  const w = data?.windows[range];
  const t = traffic[range];
  const span = range === "24h" ? "last 24 hours" : "last 7 days";
  const up = (f: number | null | undefined) => fmtUptime(typeof f === "number" ? f * 100 : null);
  const labels = w?.series.map((b) => bucketLabel(b.t, range)) ?? [];
  const points = (t?.countries ?? []).flatMap((c) => { const ll = centroid(c.code); return ll ? [{ lat: ll[0], lng: ll[1], value: c.visitors, label: c.name }] : []; });
  const tiles: [string, string, string][] = data && w ? [
    ["Uptime, 30 days", up(data.uptime["30d"]), `${up(data.uptime["7d"])} over 7 days`],
    ["Visitors", fmtInt(t?.visitors), `${fmtInt(t?.visits)} visits`],
    ["Chat requests", fmtInt(w.requests), `${fmtInt(w.errors)} failed`],
    ["Answer time", fmtMs(w.totalMs.p50), `p50 · first byte ${fmtMs(w.ttfbMs.p50)}`],
    ["Cache hit rate", fmtRate(w.cacheHitRate), `${fmtInt(w.cacheHits)} from cache`],
    ["Tokens", fmtInt(w.tokens), `est. ${fmtUsd(w.estCostUsd)}`],
  ] : [];

  return (
    <div className="adm st" data-look={look.id} style={{ colorScheme: look.dark ? "dark" : "light" }}>
      <style dangerouslySetInnerHTML={{ __html: lookCss(look, ".st") }} />
      <header className="adm-top">
        <div className="adm-top-in">
          <Link className="adm-brand" href="/"><span className="adm-logo" aria-hidden="true">R</span>rithvik.ai<small>status</small></Link>
          <div className="adm-top-r">
            <nav className="adm-seg" aria-label="Time range">
              <a href="/status" aria-current={range === "24h" ? "true" : undefined}>24 hours</a>
              <a href="/status?range=7d" aria-current={range === "7d" ? "true" : undefined}>7 days</a>
            </nav>
          </div>
        </div>
      </header>
      <main className="adm-main st-main">
        <div className="adm-hero">
          <span className="adm-eyebrow">Live · {span}</span>
          <h1>{state ? <span className={`adm-health ${state.tone}`}>{state.text}</span> : "Status data is unavailable right now."}</h1>
          {data ? (
            <>
              <ul className="adm-kpis st-kpis">
                {tiles.map(([l, v, n]) => <li key={l} className="adm-kpi"><span className="l">{l}</span><span className="v">{v}</span><span className="n">{n}</span></li>)}
              </ul>
              <p className="adm-muted" style={{ margin: 0, fontSize: 12.5 }}>Updated {fmtStamp(data.generatedAt)}. Times are UTC.</p>
            </>
          ) : <p className="adm-muted" style={{ margin: 0 }}>That says nothing about the site itself; try again in a minute.</p>}
        </div>

        {data && w && (
          <>
            <Section id="uptime" eyebrow="Availability" title="Uptime">
              <Card>
                <ul className="adm-stats">
                  {(["24h", "7d", "30d"] as const).map((k) => <li key={k} className="adm-stat"><span className="l">Last {k === "24h" ? "24 hours" : k === "7d" ? "7 days" : "30 days"}</span><span className="v">{up(data.uptime[k])}</span></li>)}
                </ul>
                {data.uptime.recent.length ? (
                  <>
                    <UptimeStrip checks={data.uptime.recent} />
                    <p className="adm-muted" style={{ margin: "10px 0 0", fontSize: 12 }}>{data.uptime.recent.length} checks over the last 24 hours. A short tick is a pass, a tall red tick a failure.</p>
                  </>
                ) : <Empty>Health checks appear here once the five-minute uptime job is running.</Empty>}
              </Card>
            </Section>

            <Section id="visitors" eyebrow="Traffic" title="Visitors" note="Bots excluded. Counts only.">
              <div className="adm-grid">
                <Card span={12} title="Where visitors are" note={t ? `${fmtInt(t.visitors)} people · countries with fewer than 3 are grouped` : undefined}>
                  {t && t.visitors ? (
                    <div className="adm-geo">
                      {points.length ? <Globe points={points} label={`Globe of visitor countries: ${points.map((p) => `${p.label} ${p.value}`).join(", ")}`} /> : <Empty>Not enough visitors from any one country to show yet.</Empty>}
                      <div style={{ display: "grid", gap: 18 }}>
                        <RankBars rows={[...t.countries.map((c) => ({ label: c.name, value: c.visitors })), ...(t.other ? [{ label: "Other countries", value: t.other }] : [])]} max={9} total={t.visitors} />
                        <CartesianChart kind="bar" upright title={`Visits per ${range === "24h" ? "hour" : "day"}, ${span}`} labels={t.series.map((b) => bucketLabel(b.t, range).replace(/ \d\d:\d\d$/, ""))} series={[{ name: "Visits", values: t.series.map((b) => b.visits) }]} height={150} />
                      </div>
                    </div>
                  ) : <Empty>{t ? `No visitors in the ${span}.` : "Visitor counts are unavailable right now."}</Empty>}
                </Card>
              </div>
            </Section>

            <Section id="agent" eyebrow="Agent" title="Chat agent" note="Per request: model, tokens, timings, errors, cache. Never message text.">
              {w.requests === 0 ? <Empty>No chat requests in the {span}.</Empty> : (
                <div className="adm-grid">
                  <Card span={6} title={`Requests per ${range === "24h" ? "hour" : "day"}`} note={`${fmtRate(w.errorRate)} errors`}>
                    <CartesianChart kind="bar" upright title={`Requests, ${span}`} labels={labels} series={[{ name: "Requests", values: w.series.map((b) => b.requests) }]} height={190} />
                  </Card>
                  <Card span={6} title="Median time to first byte" note={`p95 ${fmtMs(w.ttfbMs.p95)}`}>
                    <CartesianChart kind="line" title={`Median time to first byte, ${span}`} unit="ms" labels={labels} series={[{ name: "p50 TTFB", values: w.series.map((b) => b.p50TtfbMs) }]} height={190} />
                  </Card>
                  <Card span={6} title="Model mix" note="by requests">
                    <RankBars rows={w.models.map((m) => ({ label: m.model, value: m.requests, sub: `${fmtInt(m.tokens)} tokens` }))} max={5} total={w.requests} />
                  </Card>
                  <Card span={6} title="Build">
                    <dl className="adm-kv">
                      <div><dt>Commit</dt><dd>{data.build.commit ? data.build.commit.slice(0, 7) : "unknown"}</dd></div>
                      <div><dt>Answer model</dt><dd>{data.build.model}</dd></div>
                      <div><dt>Helper model</dt><dd>{data.build.auxModel}</dd></div>
                    </dl>
                  </Card>
                </div>
              )}
            </Section>
          </>
        )}

        <footer className="st-foot">
          <h2>How this is measured</h2>
          <p>
            Uptime comes from a synthetic check that runs every five minutes from a Supabase scheduled job and calls the site&rsquo;s health endpoint.
            Visitors are counted by the site&rsquo;s own first-party analytics with known bots removed; only totals and country-level counts are shown
            here, and countries with fewer than three visitors are grouped so no one stands out. Chat numbers are counted by the chat endpoint for each
            request: model, token count, response times, whether it errored and whether it was answered from the cache. Message text is never part of
            these metrics. Cost is an estimate from token counts and list prices, not an invoice. Percentiles are over the window shown, and a quiet
            window can make them jumpy. <a href="/privacy">Privacy</a>.
          </p>
        </footer>
      </main>
    </div>
  );
}
