/** Visitors list and the visitor inspector (server components; the replay player and chat replicas are client islands). */
import ReplayPlayer from "@/components/visitor-log/ReplayPlayer";
import type { MessageRow } from "@/lib/agent/chats";
import { countryName } from "@/lib/analytics/geo";
import type { ChatLink, EventRow, VisitorRow, VisitRow } from "@/lib/track/views";
import { describeEvent, duration, offset, place, whoLabel } from "@/lib/track/views";
import type { VisitorQuery } from "@/lib/analytics/server";
import ChatReplica from "./ChatReplica";
import { ago, Card, Empty, initials } from "./ui";

const TYPES: [string, string][] = [["", "Any network"], ["business", "Business"], ["edu", "University"], ["isp", "ISP / home"], ["hosting", "Hosting / VPN"]];
const stamp = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;

/** Filter bar (a GET form, so filters live in the URL and work without JS). */
function Filters({ f, base }: { f: VisitorQuery; base: string }) {
  return (
    <form className="adm-filters" action={`${base}/visitors`} role="search">
      <label className="sr-only" htmlFor="vq">Search visitors</label>
      <input id="vq" type="search" name="q" defaultValue={f.q} placeholder="Search name, email, company, network, city" />
      <label className="sr-only" htmlFor="vc">Country code</label>
      <input id="vc" className="adm-field" name="country" defaultValue={f.country} placeholder="Country (US)" maxLength={2} size={10} />
      <label className="sr-only" htmlFor="vt">Network type</label>
      <select id="vt" name="type" defaultValue={f.type}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <label className="chk"><input type="checkbox" name="identified" value="1" defaultChecked={f.identified} />Identified only</label>
      <button className="adm-btn primary" type="submit">Filter</button>
    </form>
  );
}

/** /admin/visitors: everyone tracked (bots hidden), newest first, paginated. */
export function VisitorsView({ rows, total, f, base, now, pageSize }: { rows: VisitorRow[]; total: number; f: VisitorQuery; base: string; now: number; pageSize: number }) {
  const qs = (page: number) => `${base}/visitors?${new URLSearchParams({ ...(f.q && { q: f.q }), ...(f.country && { country: f.country }), ...(f.type && { type: f.type }), ...(f.identified && { identified: "1" }), page: String(page) })}`;
  return (
    <main className="adm-main">
      <section className="adm-sec" aria-labelledby="v-h">
        <div className="adm-sec-h"><span className="adm-eyebrow">Audience</span><h2 id="v-h">Visitors</h2><p>{total.toLocaleString("en-US")} people, most recently seen first.</p></div>
        <Card>
          <Filters f={f} base={base} />
          <div style={{ height: 14 }} />
          {rows.length ? (
            <ul className="adm-people">
              {rows.map((v) => (
                <li key={v.id}>
                  <a className="adm-person" href={`${base}/visitors/${v.id}`}>
                    <span className="adm-avatar" aria-hidden="true">{initials(whoLabel(v))}</span>
                    <span className="main"><b>{whoLabel(v)}</b><span>{[v.email && v.email !== whoLabel(v) ? v.email : null, v.company_given || v.company, v.ip_type].filter(Boolean).join(" · ") || "Anonymous"}</span></span>
                    <span className="c">{place(v)}</span>
                    <span className="c hide-s">{[v.device, v.browser, v.os].filter(Boolean).join(" · ")}</span>
                    <span className="t">{v.visits} visit{v.visits === 1 ? "" : "s"}<br />{ago(v.last_seen, now)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <Empty title="No visitors match">Every browser that opens the site appears here (bots are hidden). Try clearing the filters.</Empty>}
          <div className="adm-pager">
            {f.page > 0 ? <a className="adm-btn sm" href={qs(f.page - 1)}>← Newer</a> : <span />}
            <span>Page {f.page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            {(f.page + 1) * pageSize < total ? <a className="adm-btn sm" href={qs(f.page + 1)}>Older →</a> : <span />}
          </div>
        </Card>
      </section>
    </main>
  );
}

const KEY = new Set(["agent_open", "agent_turn", "composer_open", "composer_send", "resume", "identify", "outbound", "design"]);

/** One visit: summary line, and inside, the full event timeline and the replay player. */
function Visit({ v, events, seqs, open, replay }: { v: VisitRow; events: EventRow[]; seqs: number[]; open: boolean; replay?: unknown[] }) {
  const active = events.filter((e) => e.type === "active").reduce((s, e) => s + (Number(e.data?.ms) || 0), 0);
  return (
    <details className="adm-visit" open={open}>
      <summary>
        <b>{stamp(v.started_at)}</b>
        <span className="adm-muted">{duration(Date.parse(v.ended_at) - Date.parse(v.started_at))} · {duration(active)} active · {events.length} events</span>
        <span className="adm-chips" style={{ marginLeft: "auto" }}>
          {v.entry_url && <span className="adm-chip">{v.entry_url}</span>}
          {v.design && <span className="adm-chip acc">{v.design}</span>}
          {v.viewport && <span className="adm-chip">{v.viewport}</span>}
        </span>
      </summary>
      <div className="adm-visit-body">
        <p className="adm-muted" style={{ margin: 0, fontSize: 12.5 }}>
          From {v.referrer || "direct"}{v.utm ? ` · ${Object.values(v.utm).join(" / ")}` : ""} · IP {v.ip ?? "–"} · {v.tz ?? "–"} · {v.lang ?? "–"}
        </p>
        {(seqs.length > 0 || replay) && <ReplayPlayer visitId={v.id} seqs={seqs} events={replay} />}
        {events.length ? (
          <ol className="adm-tl">
            {events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{offset(v.started_at, e.at)}</time>
                <span className={`dot${e.type === "error" ? " k-bad" : KEY.has(e.type) ? " k-key" : ""}`} aria-hidden="true" />
                <span className="what"><em>{e.type}</em>{describeEvent(e)}</span>
              </li>
            ))}
          </ol>
        ) : <Empty>No events in this visit.</Empty>}
      </div>
    </details>
  );
}

/** /admin/visitors/<id>: who they are (every collected field), their conversations as agent-window replicas, and every visit. */
export function VisitorInspector({ v, visits, chats, messages, base, now, replay }: {
  v: VisitorRow; visits: (VisitRow & { events: EventRow[]; replaySeqs: number[] })[]; chats: ChatLink[]; messages: Map<string, MessageRow[]>;
  base: string; now: number; replay?: unknown[];
}) {
  const who = whoLabel(v);
  const fields: [string, string | null | undefined][] = [
    ["Email", v.email], ["Name", v.name], ["Company (told us)", v.company_given], ["Company (network)", v.company], ["Network owner", v.org],
    ["ASN", v.asn], ["Network type", v.ip_type], ["Location", place(v)], ["Country", v.country ? countryName(v.country) : null], ["Timezone", v.timezone],
    ["Languages", v.languages], ["Device", v.device], ["Browser", v.browser], ["OS", v.os], ["Screen", v.screen],
    ["First seen", stamp(v.first_seen)], ["Last seen", `${stamp(v.last_seen)} (${ago(v.last_seen, now)})`], ["Visits", String(v.visits)],
    ["Identified", v.identified_at ? stamp(v.identified_at) : null], ["First referrer", v.first_referrer],
    ["First UTM", v.first_utm ? Object.entries(v.first_utm).map(([k, x]) => `${k.replace("utm_", "")}=${x}`).join(" ") : null],
    ["IPs", v.ips.join(", ")], ["User agent", v.user_agent], ["Visitor id", v.id],
  ];
  return (
    <main className="adm-main">
      <a className="adm-back" href={`${base}/visitors`}>← All visitors</a>
      <div className="adm-who">
        <span className="adm-avatar" aria-hidden="true">{initials(who)}</span>
        <div>
          <h1>{who}</h1>
          <p>{[v.company_given || v.company, place(v), `${v.visits} visit${v.visits === 1 ? "" : "s"}`, `last seen ${ago(v.last_seen, now)}`].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="adm-acts" style={{ marginLeft: "auto" }}>
          {v.email && <a className="adm-btn" href={`mailto:${v.email}`}>Email {v.name?.split(" ")[0] ?? ""}</a>}
          {chats[0] && <a className="adm-btn" href={`${base}/chats/${chats[0].id}`}>Latest chat</a>}
        </div>
      </div>
      <div className="adm-grid">
        <Card span={12} title="Profile" note="everything collected for this browser">
          <dl className="adm-profile">{fields.filter(([, x]) => x).map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x}</dd></div>)}</dl>
        </Card>
      </div>
      <section className="adm-sec" aria-labelledby="c-h">
        <div className="adm-sec-h"><span className="adm-eyebrow">Agent</span><h2 id="c-h">Conversations</h2><p>{chats.length ? "Exactly as they saw them, plus timings." : ""}</p></div>
        {chats.length ? (
          <div className="adm-grid">
            {chats.map((c) => (
              <div key={c.id} className="s6" style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <ChatReplica messages={messages.get(c.id) ?? []} short footer={`${stamp(c.created_at)} · ${c.visit_turns} question${c.visit_turns === 1 ? "" : "s"}`} />
                <a className="adm-btn sm" style={{ justifySelf: "start" }} href={`${base}/chats/${c.id}`}>Open conversation</a>
              </div>
            ))}
          </div>
        ) : <Empty>No conversations with the agent from this browser.</Empty>}
      </section>
      <section className="adm-sec" aria-labelledby="vs-h">
        <div className="adm-sec-h"><span className="adm-eyebrow">Timeline</span><h2 id="vs-h">Visits</h2><p>Newest first; every event with its offset from the visit start.</p></div>
        {visits.length ? visits.map((x, i) => <Visit key={x.id} v={x} events={x.events} seqs={x.replaySeqs} open={i === 0} replay={i === 0 ? replay : undefined} />) : <Empty>No visits recorded.</Empty>}
      </section>
    </main>
  );
}
