import type { ReactNode } from "react";
import { stamp } from "@/components/agent-log/Messages";
import { describeEvent, duration, offset, place, whoLabel, type ChatLink, type EventRow, type VisitorFilters, type VisitorRow, type VisitRow } from "@/lib/track/views";
import ReplayPlayer from "./ReplayPlayer";

/** GET filter form: identified, company, country, date range, include bots. Plain HTML, works without JS. */
export function VisitorFilterForm({ f }: { f: VisitorFilters }) {
  return (
    <form className="alog-filters" method="get" role="search" aria-label="Filter visitors">
      <label>Company or network<input type="search" name="company" defaultValue={f.company} maxLength={80} /></label>
      <label>Country (2 letters)<input type="text" name="country" defaultValue={f.country} maxLength={2} size={4} /></label>
      <label>Seen from<input type="date" name="from" defaultValue={f.from ?? ""} /></label>
      <label>Seen to<input type="date" name="to" defaultValue={f.to ?? ""} /></label>
      <label className="inline"><input type="checkbox" name="identified" value="1" defaultChecked={f.identified} />Identified</label>
      <label className="inline"><input type="checkbox" name="bots" value="1" defaultChecked={f.bots} />Include bots</label>
      <button type="submit" className="primary">Apply</button>
      <a className="alog-btn" href="?">Reset</a>
    </form>
  );
}

/** The visitor list: most recently seen first, one row per browser, linking to its timeline. */
export function VisitorTable({ rows, base = "/admin/visitors" }: { rows: VisitorRow[]; base?: string }) {
  if (rows.length === 0) return <p className="alog-muted">No visitors match.</p>;
  return (
    <div className="alog-tablewrap">
      <table>
        <caption>{rows.length} visitor{rows.length === 1 ? "" : "s"}, most recently seen first</caption>
        <thead>
          <tr>
            <th scope="col">Last seen</th><th scope="col">Visitor</th><th scope="col">Company / network</th><th scope="col">Location</th>
            <th scope="col">Device</th><th scope="col" className="num">Visits</th><th scope="col">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id}>
              <td><a href={`${base}/${v.id}`}>{stamp(v.last_seen)}</a></td>
              <td>{v.email || v.name ? <>{v.name}<br /><span className="alog-muted">{v.email}</span></> : <span className="alog-muted">{whoLabel(v) === "anonymous" ? "anonymous" : "—"}</span>}</td>
              <td>{v.company_given || v.company || v.org || <span className="alog-muted">—</span>}{v.ip_type && <> <span className="alog-tag">{v.ip_type}</span></>}</td>
              <td>{place(v)}</td>
              <td>{[v.browser, v.os].filter(Boolean).join(" · ") || "—"}</td>
              <td className="num">{v.visits}</td>
              <td>
                {v.email && <span className="alog-tag hot">identified</span>}{" "}
                {v.is_bot && <span className="alog-tag">bot</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Visitor header: identity, network, place, device, first touch. The raw IPs are shown (owner only). */
export function VisitorMeta({ v }: { v: VisitorRow }) {
  const utm = v.first_utm ? Object.entries(v.first_utm).map(([k, x]) => `${k.replace("utm_", "")}=${x}`).join(", ") : "";
  const rows: [string, ReactNode][] = [
    ["Email", v.email ? <a href={`mailto:${v.email}`}>{v.email}</a> : "—"],
    ["Name", [v.name, v.company_given].filter(Boolean).join(", ") || "—"],
    ["Identified", v.identified_at ? stamp(v.identified_at) : "—"],
    ["Company (from IP)", [v.company, v.ip_type && `(${v.ip_type})`].filter(Boolean).join(" ") || "—"],
    ["Network", [v.org, v.asn].filter(Boolean).join(" · ") || "—"],
    ["Location", `${place(v)}${v.timezone ? ` · ${v.timezone}` : ""}`],
    ["IP addresses", v.ips.length ? v.ips.join(", ") : v.last_ip || "—"],
    ["Device", [v.browser, v.os, v.device, v.screen].filter(Boolean).join(" · ") || "—"],
    ["Languages", v.languages || "—"],
    ["First seen", stamp(v.first_seen)],
    ["Last seen", stamp(v.last_seen)],
    ["Visits", String(v.visits)],
    ["First referrer", v.first_referrer || "—"],
    ["First UTM", utm || "—"],
    ["Visitor id", <span className="alog-mono" key="id">{v.id}</span>],
  ];
  return (
    <dl className="alog-dl">
      {rows.map(([k, x]) => (<div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{x}</dd></div>))}
    </dl>
  );
}

/** Agent conversations this visitor had, linking to the full transcript. */
export function ChatList({ chats, base = "/admin/chats" }: { chats: ChatLink[]; base?: string }) {
  if (chats.length === 0) return <p className="alog-muted">No agent conversations.</p>;
  return (
    <ul className="alog-chats">
      {chats.map((c) => (
        <li key={c.id}>
          <a href={`${base}/${c.id}`}>{stamp(c.created_at)}</a> · {c.visit_turns} turn{c.visit_turns === 1 ? "" : "s"}
          {c.preview && <> · <span className="alog-muted">{c.preview.slice(0, 100)}</span></>}
        </li>
      ))}
    </ul>
  );
}

/** One visit: entry, referrer, UTM, device, duration, every event in order, and the replay player. */
export function VisitCard({ visit, events, replaySeqs, replayEvents }: { visit: VisitRow; events: EventRow[]; replaySeqs: number[]; replayEvents?: unknown[] }) {
  const utm = visit.utm ? Object.entries(visit.utm).map(([k, x]) => `${k.replace("utm_", "")}=${x}`).join(", ") : "";
  const meta = [
    ["Entry", visit.entry_url || "—"], ["Referrer", visit.referrer || "direct"], ["UTM", utm || "—"], ["Design", visit.design || "—"],
    ["Viewport", visit.viewport || "—"], ["IP", visit.ip || "—"],
  ];
  return (
    <section className="alog-visit" aria-label={`Visit ${stamp(visit.started_at)}`}>
      <h3>
        {stamp(visit.started_at)} <span className="alog-muted">· {duration(Date.parse(visit.ended_at) - Date.parse(visit.started_at))} · {events.length} events</span>
        {visit.is_bot && <> <span className="alog-tag">bot</span></>}
      </h3>
      <p className="alog-visit-meta">{meta.map(([k, x]) => <span key={k}><span className="alog-muted">{k}</span> {x}</span>)}</p>
      {(replaySeqs.length > 0 || replayEvents) && <ReplayPlayer visitId={visit.id} seqs={replaySeqs} events={replayEvents} />}
      {events.length === 0 ? <p className="alog-muted">No events.</p> : (
        <ol className="alog-events">
          {events.map((e) => (
            <li key={e.id} data-type={e.type}>
              <time className="alog-mono">{offset(visit.started_at, e.at)}</time>
              <span className="alog-etype">{e.type}</span>
              <span>{describeEvent(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
