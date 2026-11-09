/** Chats list and one conversation (as a replica of the agent window, with the owner's follow-up controls beside it). */
import type { Filters, MessageRow, SessionRow } from "@/lib/agent/chats";
import { placeLabel } from "@/lib/agent/chats";
import type { SessionSummary } from "@/lib/agent/chats-query";
import { fmtInt, fmtMs } from "@/lib/status/format";
import ChatReplica from "./ChatReplica";
import { ago, Card, Empty } from "./ui";

const stamp = (iso: string) => `${iso.slice(0, 16).replace("T", " ")} UTC`;
const isOwnerRow = (s: SessionRow) => (s as SessionRow & { is_owner?: boolean }).is_owner === true;

/** /admin/chats: every conversation, newest first, searchable (GET form). */
export function ChatsView({ rows, f, base, now }: { rows: SessionSummary[]; f: Filters; base: string; now: number }) {
  return (
    <main className="adm-main">
      <section className="adm-sec" aria-labelledby="ch-h">
        <div className="adm-sec-h"><span className="adm-eyebrow">Agent</span><h2 id="ch-h">Conversations</h2><p>{rows.length} shown, newest first.</p></div>
        <Card>
          <form className="adm-filters" action={`${base}/chats`} role="search">
            <label className="sr-only" htmlFor="cq">Search messages</label>
            <input id="cq" type="search" name="q" defaultValue={f.q} placeholder="Search what was said" />
            <label className="chk"><input type="checkbox" name="email" value="1" defaultChecked={f.email} />Left an email</label>
            <label className="chk"><input type="checkbox" name="follow" value="1" defaultChecked={f.followUp} />Flagged</label>
            <button className="adm-btn primary" type="submit">Filter</button>
          </form>
          <div style={{ height: 14 }} />
          {rows.length ? (
            <ul className="adm-people">
              {rows.map((s) => (
                <li key={s.id}>
                  <a className="adm-person" href={`${base}/chats/${s.id}`}>
                    <span className="adm-avatar" aria-hidden="true">✻</span>
                    <span className="main"><b>{s.preview || "(no question)"}</b><span>{[s.visitor_name, s.visitor_email, s.visitor_company].filter(Boolean).join(" · ") || "Anonymous"}</span></span>
                    <span className="c">{placeLabel(s)}</span>
                    <span className="c hide-s adm-chips">
                      {isOwnerRow(s) && <span className="adm-chip">you</span>}
                      {s.follow_up && <span className="adm-chip acc">flagged</span>}
                      {s.share_token && <span className="adm-chip">shared</span>}
                      {s.first_design && <span className="adm-chip">{s.first_design}</span>}
                    </span>
                    <span className="t">{s.turns} turn{s.turns === 1 ? "" : "s"}<br />{ago(s.created_at, now)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : <Empty title="No conversations match">Every conversation with the agent is logged here (yours too, marked “you”, and left out of the analytics).</Empty>}
        </Card>
      </section>
    </main>
  );
}

/** /admin/chats/<id>: the conversation in the agent's own window, with who/where, totals, and follow-up + notes. */
export function ChatView({ s, messages, base, visitorId, actions }: {
  s: SessionRow; messages: MessageRow[]; base: string; visitorId: string | null;
  actions?: { setFollowUp: (fd: FormData) => Promise<void>; saveNotes: (fd: FormData) => Promise<void> };
}) {
  const answers = messages.filter((m) => m.role === "assistant");
  const tokens = answers.reduce((x, m) => x + (m.tokens_in ?? 0) + (m.tokens_out ?? 0), 0);
  const ttfb = answers.map((m) => m.ttfb_ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  const meta: [string, string | null][] = [
    ["Started", stamp(s.created_at)], ["Last message", stamp(s.last_at)], ["Place", placeLabel(s)], ["Referrer", s.referrer], ["First look", s.first_design],
    ["Name", s.visitor_name], ["Email", s.visitor_email], ["Company", s.visitor_company], ["Device", s.user_agent],
    ["Share link", s.share_token ? `/c/${s.share_token}` : null],
  ];
  return (
    <main className="adm-main">
      <a className="adm-back" href={`${base}/chats`}>← All conversations</a>
      <div className="adm-chat-layout">
        <ChatReplica messages={messages} model={answers.find((m) => m.model)?.model ?? undefined} footer={`${messages.filter((m) => m.role === "user").length} questions · read-only replica`} />
        <aside className="adm-side">
          <Card>
            <ul className="adm-stats" style={{ margin: 0 }}>
              <li className="adm-stat"><span className="l">Tokens</span><span className="v">{fmtInt(tokens)}</span></li>
              <li className="adm-stat"><span className="l">Median first byte</span><span className="v">{fmtMs(ttfb.length ? ttfb[Math.floor(ttfb.length / 2)] : null)}</span></li>
            </ul>
          </Card>
          <Card title="Who and where">
            <dl className="adm-profile" style={{ gridTemplateColumns: "1fr" }}>{meta.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <div className="adm-acts" style={{ marginTop: 14 }}>
              {visitorId && <a className="adm-btn sm" href={`${base}/visitors/${visitorId}`}>Open visitor</a>}
              {s.visitor_email && <a className="adm-btn sm" href={`mailto:${s.visitor_email}`}>Email</a>}
            </div>
          </Card>
          <Card title="Follow-up">
            {actions ? (
              <div style={{ display: "grid", gap: 10 }}>
                <form action={actions.setFollowUp}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="on" value={s.follow_up ? "0" : "1"} />
                  <button className="adm-btn" type="submit" aria-pressed={s.follow_up}>{s.follow_up ? "★ Flagged (click to clear)" : "☆ Flag for follow-up"}</button>
                </form>
                <form action={actions.saveNotes} style={{ display: "grid", gap: 8 }}>
                  <input type="hidden" name="id" value={s.id} />
                  <label className="adm-muted" htmlFor="notes" style={{ fontSize: 12 }}>Private notes</label>
                  <textarea id="notes" className="adm-field" name="notes" defaultValue={s.notes ?? ""} maxLength={5000} />
                  <button className="adm-btn primary" type="submit" style={{ justifySelf: "start" }}>Save notes</button>
                </form>
              </div>
            ) : <Empty>Flag and notes controls appear here when signed in.</Empty>}
          </Card>
        </aside>
      </div>
    </main>
  );
}
