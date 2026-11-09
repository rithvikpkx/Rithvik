import type { Filters, SessionRow } from "@/lib/agent/chats";
import { placeLabel } from "@/lib/agent/chats";
import type { SessionSummary } from "@/lib/agent/chats-query";
import { stamp } from "./Messages";

/** GET filter form: has-email, follow-up, date range, message text. Plain HTML, works without JS. */
export function FilterForm({ f }: { f: Filters }) {
  return (
    <form className="alog-filters" method="get" role="search" aria-label="Filter conversations">
      <label>Search messages<input type="search" name="q" defaultValue={f.q} maxLength={100} /></label>
      <label>From<input type="date" name="from" defaultValue={f.from ?? ""} /></label>
      <label>To<input type="date" name="to" defaultValue={f.to ?? ""} /></label>
      <label className="inline"><input type="checkbox" name="email" value="1" defaultChecked={f.email} />Has email</label>
      <label className="inline"><input type="checkbox" name="follow" value="1" defaultChecked={f.followUp} />Follow up</label>
      <button type="submit" className="primary">Apply</button>
      <a className="alog-btn" href="?">Reset</a>
    </form>
  );
}

/** The session list: newest first, one row per conversation, linking to the full transcript. */
export function SessionTable({ rows, base = "/admin/chats" }: { rows: SessionSummary[]; base?: string }) {
  if (rows.length === 0) return <p className="alog-muted">No conversations match.</p>;
  return (
    <div className="alog-tablewrap">
      <table>
        <caption>{rows.length} conversation{rows.length === 1 ? "" : "s"}, newest first</caption>
        <thead>
          <tr>
            <th scope="col">Started</th><th scope="col">Visitor</th><th scope="col">Location</th>
            <th scope="col" className="num">Turns</th><th scope="col">First question</th><th scope="col">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td><a href={`${base}/${s.id}`}>{stamp(s.created_at)}</a></td>
              <td>{s.visitor_name || s.visitor_email ? <>{s.visitor_name}<br /><span className="alog-muted">{s.visitor_email}</span></> : <span className="alog-muted">anonymous</span>}</td>
              <td>{placeLabel(s)}</td>
              <td className="num">{s.turns}</td>
              <td className="prev" title={s.preview}>{s.preview || "—"}</td>
              <td>
                {s.follow_up && <span className="alog-tag hot">follow up</span>}{" "}
                {s.share_token && <span className="alog-tag">shared</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Session header: who, where, from what, and when. */
export function SessionMeta({ s }: { s: SessionRow }) {
  const rows: [string, React.ReactNode][] = [
    ["Started", stamp(s.created_at)],
    ["Last activity", stamp(s.last_at)],
    ["Location", placeLabel(s)],
    ["Referrer", s.referrer || "—"],
    ["First design", s.first_design || "—"],
    ["Browser", s.user_agent || "—"],
    ["Visitor", [s.visitor_name, s.visitor_company].filter(Boolean).join(", ") || "—"],
    ["Email", s.visitor_email ? <a href={`mailto:${s.visitor_email}`}>{s.visitor_email}</a> : "—"],
    ["Share link", s.share_token ? `/c/${s.share_token} (expires ${stamp(s.share_expires_at ?? "")})` : "none"],
  ];
  return (
    <dl className="alog-dl">
      {rows.map(([k, v]) => (<div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>))}
    </dl>
  );
}
