import type { Metadata } from "next";
import Link from "next/link";
import "@/components/admin/admin.css";
import "@/components/site/charts/charts.css";
import "./status.css";
import { UptimeStrip } from "@/components/site/charts/Figures";
import Mark from "@/components/site/mark/Mark";
import Pulse from "@/components/admin/Pulse";
import { Empty, Panel, Ranks } from "@/components/admin/ui";
import { DayRing } from "@/components/admin/viz";
import { toMs } from "@/lib/charts/scale";
import { bucketLabel, fmtInt, fmtMs, fmtRate, fmtStamp, fmtUptime, fmtUsd, healthState } from "@/lib/status/format";
import { loadStatus, loadTraffic } from "@/lib/status/load";

export const metadata: Metadata = {
  title: "Status",
  description: "Live uptime, visitors, response times, errors and cost for rithvik.ai and its chat agent.",
  alternates: { canonical: "/status" },
};

/** /status: the public, condensed version of the admin dashboard in the same dark instrument language. Counts and
 *  timings only: no IPs, organisations, emails, questions or cities, and countries with fewer than three visitors
 *  are grouped as "other". Server-rendered; the 24h / 7d switch is a link. */
export default async function StatusPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const range = (await searchParams).range === "7d" ? "7d" : "24h";
  const [data, traffic] = await Promise.all([loadStatus(), loadTraffic()]);
  const state = data ? healthState(data.uptime.recent) : null;
  const w = data?.windows[range];
  const t = traffic[range];
  const span = range === "24h" ? "last 24 hours" : "last 7 days";
  const up = (f: number | null | undefined) => fmtUptime(typeof f === "number" ? f * 100 : null);
  const labels = (s: { t: number | string }[]) => s.map((b) => bucketLabel(b.t, range).replace(range === "7d" ? / \d\d:\d\d$/ : /$^/, ""));
  // the last 24 hours of visits placed at their UTC hour: the same day ring as /admin
  const ring = Array<number>(24).fill(0);
  for (const b of traffic["24h"]?.series ?? []) ring[new Date(toMs(b.t)).getUTCHours()] += b.visits;
  const hour = data ? new Date(toMs(data.generatedAt)).getUTCHours() : undefined;

  return (
    <div className="dash d-status">
      <header className="d-top">
        <div className="d-top-in">
          <Link className="d-brand" href="/" aria-label="rithvik.ai home">
            <span className="d-brand-mark"><Mark kind="solid" blink label="" /></span>
            <span className="d-path">rithvik.ai<em>/status</em></span>
          </Link>
          <div className="d-top-r">
            <nav className="d-seg" aria-label="Time range">
              <a href="/status" aria-current={range === "24h" ? "true" : undefined}>24h</a>
              <a href="/status?range=7d" aria-current={range === "7d" ? "true" : undefined}>7d</a>
            </nav>
          </div>
        </div>
      </header>
      <main className="d-main">
        <section className="d-hero" aria-label="Current status">
          <div className="d-hero-l">
            <p className="d-kicker">{data ? `updated ${fmtStamp(data.generatedAt).toLowerCase()}` : "status"}</p>
            <h1 className={`d-state ${state?.tone ?? "none"}`}><i aria-hidden="true" />{state ? state.text : "Status data is unavailable right now."}</h1>
            {data ? (
              <ul className="d-big">
                <li><span className="v">{up(data.uptime["30d"])}</span><span className="l">uptime · 30 days</span></li>
                <li><span className="v">{fmtInt(t?.visitors)}</span><span className="l">visitors · {range}</span></li>
                <li><span className="v">{fmtMs(w?.totalMs.p50)}</span><span className="l">answer time · p50</span></li>
              </ul>
            ) : <p className="d-empty">That says nothing about the site itself; try again in a minute.</p>}
          </div>
          <DayRing values={ring} labels={["00", "06", "12", "18"]} now={hour} size={300} label={`Visits in the last 24 hours by UTC hour: ${fmtInt(ring.reduce((a, b) => a + b, 0))} in total.`}>
            visits · last 24h · utc
          </DayRing>
        </section>

        {data && w && (
          <>
            <Panel label="health checks · every 5 minutes" aside={<span className="d-uptimes">{(["24h", "7d", "30d"] as const).map((k) => <span key={k}>{k}<b>{up(data.uptime[k])}</b></span>)}</span>}>
              {data.uptime.recent.length ? <UptimeStrip checks={data.uptime.recent} /> : <Empty>Health checks appear here once the five-minute uptime job is running.</Empty>}
            </Panel>

            <div className="d-grid">
              <Panel label={`visitors · ${span}`} span={6} i={1} aside={t ? `${fmtInt(t.visits)} visits` : undefined}>
                {t && t.visitors ? (
                  <>
                    <Pulse title={`Visits per ${range === "24h" ? "hour" : "day"}, ${span}`} labels={labels(t.series)} series={[{ name: "visits", values: t.series.map((b) => b.visits) }]} height={140} />
                    <h4 className="d-sub">countries · fewer than 3 grouped</h4>
                    <Ranks rows={[...t.countries.map((c) => ({ label: c.name, value: c.visitors })), ...(t.other ? [{ label: "other", value: t.other }] : [])]} max={6} total={t.visitors} />
                  </>
                ) : <Empty>{t ? `No visitors in the ${span}.` : "Visitor counts are unavailable right now."}</Empty>}
              </Panel>
              <Panel label={`agent · ${span}`} span={6} i={2} aside="never message text">
                {w.requests === 0 ? <Empty>No chat requests in the {span}.</Empty> : (
                  <>
                    <ul className="d-mini">
                      <li><b>{fmtInt(w.requests)}</b>requests</li>
                      <li className={w.errors ? "bad" : undefined}><b>{fmtRate(w.errorRate)}</b>errors</li>
                      <li><b>{fmtMs(w.ttfbMs.p50)}</b>first byte</li>
                      <li><b>{fmtRate(w.cacheHitRate)}</b>cache</li>
                    </ul>
                    <Pulse tone="amber" title={`Requests per ${range === "24h" ? "hour" : "day"}, ${span}`} labels={labels(w.series)} series={[{ name: "requests", values: w.series.map((b) => b.requests) }]} height={120} />
                    <h4 className="d-sub">models · {fmtInt(w.tokens)} tokens · {fmtUsd(w.estCostUsd)}</h4>
                    <Ranks rows={w.models.map((m) => ({ label: m.model, value: m.requests }))} max={4} total={w.requests} tone="amber" />
                  </>
                )}
              </Panel>
            </div>
          </>
        )}

        <footer className="d-foot">
          <details>
            <summary>how this is measured</summary>
            <p>
              Uptime comes from a synthetic check every five minutes against the site&rsquo;s health endpoint. Visitors are counted by the
              site&rsquo;s own first-party analytics with known bots removed; only totals and country counts are shown, and countries with fewer
              than three visitors are grouped so no one stands out. Chat numbers are counted per request: model, tokens, timings, errors and
              cache hits, never message text. Cost is an estimate from token counts and list prices. {data && <>Build {data.build.commit ? data.build.commit.slice(0, 7) : "unknown"} · {data.build.model}.</>} <a href="/privacy">Privacy</a>.
            </p>
          </details>
        </footer>
      </main>
    </div>
  );
}
