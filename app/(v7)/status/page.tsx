import type { Metadata } from "next";
import Link from "next/link";
import "@/components/site/charts/charts.css";
import "./status.css";
import { UptimeStrip } from "@/components/site/charts/Figures";
import StatusPanels from "@/components/status/StatusPanels";
import { fmtStamp, fmtUptime, healthState } from "@/lib/status/format";
import { loadStatus } from "@/lib/status/load";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Status",
  description: "Live uptime, response times, errors and cost for rithvik.ai and its chat agent.",
  alternates: { canonical: "/status" },
};

/** /status: a calm public status page. Server-rendered from /api/status (cached 60s); only the range switch and the
 *  charts' hover are client code. Counts and timings only, never message content. */
export default async function StatusPage() {
  const data = await loadStatus();
  const state = data ? healthState(data.uptime.recent) : null;
  return (
    <div className="st">
      <main className="st-wrap">
        <header className="st-head">
          <Link className="st-back" href="/">rithvik.ai</Link>
          <h1>Status</h1>
          {state && (
            <p className={`st-pill ${state.tone}`} role="status"><span className="dot" aria-hidden="true" />{state.text}</p>
          )}
          {data && <p className="st-sub">Updated {fmtStamp(data.generatedAt)}. Times are UTC.</p>}
        </header>

        {!data || !state ? (
          <p className="st-card st-down">Status data is unavailable right now. That says nothing about the site itself; try again in a minute.</p>
        ) : (
          <>
            <section aria-labelledby="st-uptime" className="st-block">
              <h2 id="st-uptime">Uptime</h2>
              <ul className="st-tiles three" aria-label="Uptime by period">
                {(["24h", "7d", "30d"] as const).map((k) => (
                  <li key={k} className="st-tile"><span className="l">Last {k === "24h" ? "24 hours" : k === "7d" ? "7 days" : "30 days"}</span><span className="v">{fmtUptime(data.uptime[k])}</span></li>
                ))}
              </ul>
              <div className="st-card">
                <UptimeStrip checks={data.uptime.recent} />
                <p className="st-note">{data.uptime.recent.length} checks over the last 24 hours, one every five minutes. A short tick is a pass, a tall red tick a failure.</p>
              </div>
            </section>

            <StatusPanels data={data} />

            <section aria-labelledby="st-build" className="st-block">
              <h2 id="st-build">Build</h2>
              <dl className="st-card st-dl">
                <div><dt>Commit</dt><dd><code>{data.build.commit ? data.build.commit.slice(0, 7) : "unknown"}</code></dd></div>
                <div><dt>Answer model</dt><dd><code>{data.build.model}</code></dd></div>
                <div><dt>Helper model</dt><dd><code>{data.build.auxModel}</code></dd></div>
              </dl>
            </section>
          </>
        )}

        <footer className="st-foot">
          <h2>How this is measured</h2>
          <p>
            Uptime comes from a synthetic check that runs every five minutes from a Supabase scheduled job and calls the site&rsquo;s health endpoint.
            Traffic numbers are counted by the chat endpoint for each request: model, token count, response times, whether it errored and whether it was
            answered from the cache. Message text is never part of these metrics. Cost is an estimate from token counts and list prices, not an invoice.
            Percentiles are over the window shown, and a quiet window can make them jumpy.
          </p>
        </footer>
      </main>
    </div>
  );
}
