/** Chats: the list (each conversation as a glyph strip, grouped by day, keyboard-navigable) and one conversation
 *  (a trace waterfall of its turns, the agent-window replica, and the owner's flag + notes). */
import type { CSSProperties } from "react";
import type { Filters, MessageRow, SessionRow } from "@/lib/agent/chats";
import { placeLabel } from "@/lib/agent/chats";
import type { SessionSummary } from "@/lib/agent/chats-query";
import { estimateCost } from "@/lib/agent/pricing";
import type { Strip } from "@/lib/analytics/strips";
import { fmtInt, fmtMs, fmtUsd } from "@/lib/status/format";
import { duration } from "@/lib/track/views";
import { deleteChat } from "@/app/admin/chats-actions";
import Trash from "./Trash";
import ChatReplica from "./ChatReplica";
import { KeyNav, Logo } from "./live";
import { ago, dayLabel, Empty, Panel, stamp, workDomain } from "./ui";
import { GlyphStrip, Hist, Ico, Sigil } from "./viz";

type S = SessionRow & { is_owner?: boolean; visitor_id?: string | null };
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : null; } catch { return null; } };

/** The visitor's face: their employer's logo when their email says who that is, else their sigil. */
function Face({ s, size = 36 }: { s: S; size?: number }) {
  const sigil = <Sigil id={s.visitor_id ?? s.id} size={size} />;
  const d = workDomain(s.visitor_email);
  return d ? <span className="d-logo-big" style={{ width: size, height: size }}><Logo host={d} fallback={sigil} /></span> : sigil;
}

/** /admin/chats: every conversation, newest first, grouped by day; GET filters; j/k + Enter. */
export function ChatsView({ rows, f, base, now, strips }: { rows: SessionSummary[]; f: Filters; base: string; now: number; strips: Record<string, Strip> }) {
  const groups: [string, SessionSummary[]][] = [];
  for (const s of rows) {
    const day = dayLabel(s.created_at, now);
    if (groups.at(-1)?.[0] === day) groups.at(-1)![1].push(s); else groups.push([day, [s]]);
  }
  let i = 0;
  return (
    <main className="d-main tight">
      <header className="d-listhead">
        <h1>Chats<small>{rows.length} shown</small></h1>
        <div className="d-histw"><Hist times={rows.map((r) => r.created_at)} now={now} label="Conversations per day, last 30 days" />last 30 days</div>
      </header>
      <form className="d-cmd" action={`${base}/chats`} role="search">
        <span aria-hidden="true">❯</span>
        <label className="sr-only" htmlFor="cq">Search what was said</label>
        <input id="cq" type="search" name="q" defaultValue={f.q} placeholder="search what was said" />
        <div className="d-toggles">
          <label><input type="checkbox" name="email" value="1" defaultChecked={f.email} />left an email</label>
          <label><input type="checkbox" name="follow" value="1" defaultChecked={f.followUp} />flagged</label>
        </div>
        <button type="submit">filter</button>
      </form>
      <p className="d-keys"><kbd>j</kbd> <kbd>k</kbd> move · <kbd>enter</kbd> open · <kbd>/</kbd> search · <span className="g-key"><i className="d-leg u" />question <i className="d-leg t" />tool <i className="d-leg a" />answer <i className="d-leg e" />failed</span></p>
      {rows.length ? (
        <KeyNav>
          {groups.map(([day, list]) => (
            <section key={day} aria-label={day}>
              <h2 className="d-day">{day}</h2>
              <ul className="d-rows">
                {list.map((s0) => {
                  const s = s0 as SessionSummary & S;
                  const st = strips[s.id];
                  const who = [s.visitor_name, s.visitor_company, s.visitor_email && !s.visitor_name ? s.visitor_email : null].filter(Boolean).join(" · ");
                  return (
                    <li key={s.id}>
                      <a className="d-row" data-row href={`${base}/chats/${s.id}`} style={{ ["--i" as string]: i++ } as CSSProperties}>
                        <Face s={s} />
                        <span className="main">
                          <b>{s.preview || "(no question)"}</b>
                          <span>
                            {s.follow_up && <span className="d-flag" title="Flagged"><Ico name="flag" label="flagged" /></span>}
                            {s.is_owner && <span className="d-chip">you</span>}
                            {s.country && <span className="d-cc">{s.country}</span>}
                            <span className="t">{who || [s.city, host(s.referrer)].filter(Boolean).join(" · ") || "anonymous"}</span>
                          </span>
                        </span>
                        {st ? <GlyphStrip marks={st.marks} label={`${s.turns} questions over ${duration(st.ms)}`} /> : <span />}
                        <span className="meta">{s.turns} q · {duration(st?.ms ?? 0)}<small>{st ? `${fmtInt(st.tokens)} tok` : ""}</small></span>
                        <span className="when">{ago(s.created_at, now)}</span>
                      </a>
                      <Trash id={s.id} action={deleteChat} what="conversation" />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </KeyNav>
      ) : <Empty>No conversations match. Every conversation with the agent lands here (yours too, marked “you”, and left out of the analytics).</Empty>}
    </main>
  );
}

type Turn = { q: string; tools: string[]; a: MessageRow | null };

/** Groups a transcript into turns: a question, the tools it triggered, and its answer. */
function turnsOf(messages: MessageRow[]): Turn[] {
  const out: Turn[] = [];
  for (const m of messages) {
    if (m.role === "user") out.push({ q: m.content, tools: [], a: null });
    else if (m.role === "tool") {
      const t = (m.tools && typeof m.tools === "object" ? m.tools : {}) as { name?: unknown };
      (out.at(-1) ?? (out.push({ q: "", tools: [], a: null }), out.at(-1)!)).tools.push(typeof t.name === "string" ? t.name : m.content || "tool");
    } else if (out.at(-1) && !out.at(-1)!.a) out.at(-1)!.a = m;
    else out.push({ q: "", tools: [], a: m });
  }
  return out;
}

/** /admin/chats/<id>: who asked, the turns as a waterfall, the conversation in the agent's own window, flag + notes. */
export function ChatView({ s: s0, messages, base, visitorId, actions }: {
  s: SessionRow; messages: MessageRow[]; base: string; visitorId: string | null;
  actions?: { setFollowUp: (fd: FormData) => Promise<void>; saveNotes: (fd: FormData) => Promise<void> };
}) {
  const s = { ...s0, visitor_id: visitorId } as S;
  const turns = turnsOf(messages);
  const answers = messages.filter((m) => m.role === "assistant");
  const tokens = answers.reduce((x, m) => x + (m.tokens_in ?? 0) + (m.tokens_out ?? 0), 0);
  const cost = answers.reduce((x, m) => x + estimateCost(m.model ?? "", (m.tokens_in ?? 0) + (m.tokens_out ?? 0)), 0);
  const ttfb = answers.map((m) => m.ttfb_ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
  const max = Math.max(1, ...answers.map((m) => m.total_ms ?? m.ttfb_ms ?? 0));
  const span = Date.parse(s.last_at) - Date.parse(s.created_at);
  const first = turns.find((t) => t.q)?.q;
  const facts: [string, string | null][] = [
    ["name", s.visitor_name], ["email", s.visitor_email], ["company", s.visitor_company], ["place", placeLabel(s) === "—" ? null : placeLabel(s)],
    ["came from", s.referrer], ["first look", s.first_design], ["started", stamp(s.created_at)], ["device", s.user_agent],
    ["share link", s.share_token ? `/c/${s.share_token}` : null],
  ];
  return (
    <main className="d-main tight">
      <a className="d-back" href={`${base}/chats`}>← chats</a>
      <header className="d-who">
        <Face s={s} size={72} />
        <div>
          <h1 className="q">{first ? `“${first}”` : "Conversation"}</h1>
          <p>
            <span>{s.visitor_name || s.visitor_email || "anonymous"}</span>
            {placeLabel(s) !== "—" && <span>{placeLabel(s)}</span>}
            {host(s.referrer) && <span>via {host(s.referrer)}</span>}
            <span>{stamp(s.created_at)}</span>
          </p>
        </div>
        <div className="d-acts">
          {visitorId && <a href={`${base}/visitors/${visitorId}`}>visitor</a>}
          {s.visitor_email && <a href={`mailto:${s.visitor_email}`}>email</a>}
        </div>
      </header>

      <Panel label="trace">
        <div className="d-trace-h">
          <span><b>{turns.length}</b>turns</span>
          <span><b>{duration(Math.max(0, span))}</b>long</span>
          <span><b>{fmtMs(ttfb.length ? ttfb[Math.floor(ttfb.length / 2)] : null)}</b>median first byte</span>
          <span><b>{fmtInt(tokens)}</b>tokens · {fmtUsd(cost)}</span>
        </div>
        {turns.length ? (
          <ol className="d-trace">
            {turns.map((t, i) => {
              const a = t.a, w = a?.ttfb_ms ?? 0, tot = a?.total_ms ?? w;
              const bad = !!a && (!!a.error || (a.status ?? 0) >= 400);
              return (
                <li key={i}>
                  <span className="i">{String(i + 1).padStart(2, "0")}</span>
                  <span className="q"><b title={t.q}>{t.q || "(no question)"}</b>{t.tools.length > 0 && <span>{t.tools.map((n, j) => <code key={j}>⏺ {n}</code>)}</span>}</span>
                  <span className="lane" role="img" aria-label={a ? `first byte ${fmtMs(a.ttfb_ms)}, done ${fmtMs(a.total_ms)}${a.cached ? ", from cache" : ""}${bad ? ", failed" : ""}` : "no answer"}>
                    {a && <i className="w" style={{ left: 0, width: `${(w / max) * 100}%`, ["--i" as string]: i } as CSSProperties} />}
                    {a && <i className={`s${a.cached ? " cache" : ""}${bad ? " err" : ""}`} style={{ left: `${(w / max) * 100}%`, width: `${(Math.max(0, tot - w) / max) * 100}%`, minWidth: 3, ["--i" as string]: i } as CSSProperties} />}
                  </span>
                  <span className="v">{a ? (bad ? `failed ${a.status ?? ""}` : fmtMs(a.total_ms)) : "–"}<small>{a ? (a.cached ? "cache" : `${fmtInt((a.tokens_in ?? 0) + (a.tokens_out ?? 0))} tok`) : ""}</small></span>
                </li>
              );
            })}
          </ol>
        ) : <Empty>No messages in this conversation.</Empty>}
      </Panel>

      <div className="d-chat">
        <ChatReplica messages={messages} model={answers.find((m) => m.model)?.model ?? undefined} footer={`${turns.length} turns · read-only replica`} />
        <aside className="d-side">
          <Panel label="follow-up">
            {actions ? (
              <div style={{ display: "grid", gap: 12 }}>
                <form action={actions.setFollowUp}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="on" value={s.follow_up ? "0" : "1"} />
                  <button className={`d-btn${s.follow_up ? " on" : ""}`} type="submit" aria-pressed={s.follow_up}><Ico name="flag" />{s.follow_up ? "flagged" : "flag"}</button>
                </form>
                <form action={actions.saveNotes} style={{ display: "grid", gap: 8 }}>
                  <input type="hidden" name="id" value={s.id} />
                  <label className="sr-only" htmlFor="notes">Private notes</label>
                  <textarea id="notes" name="notes" defaultValue={s.notes ?? ""} maxLength={5000} placeholder="private notes" />
                  <button className="d-btn solid" type="submit" style={{ justifySelf: "start" }}>save</button>
                </form>
              </div>
            ) : <Empty>Flag and notes appear here when signed in.</Empty>}
          </Panel>
          <Panel label="who and where">
            <dl className="d-kv">{facts.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </Panel>
        </aside>
      </div>
    </main>
  );
}
