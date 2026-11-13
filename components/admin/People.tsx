/** Visitors: the list (sigil or company logo, 30-day activity cells, key-event glyphs; keyboard-navigable) and the
 *  inspector (who they are in four groups, each visit as a track of glyphs that opens into events + replay, and their
 *  conversations as agent-window replicas). */
import { Fragment, type CSSProperties } from "react";
import ReplayPlayer from "@/components/visitor-log/ReplayPlayer";
import type { MessageRow } from "@/lib/agent/chats";
import { countryName } from "@/lib/analytics/geo";
import type { VisitorQuery } from "@/lib/analytics/server";
import type { Activity } from "@/lib/analytics/strips";
import type { ChatLink, EventRow, VisitorRow, VisitRow } from "@/lib/track/views";
import { describeEvent, duration, offset, place, whoLabel } from "@/lib/track/views";
import ChatReplica from "./ChatReplica";
import Trash from "./Trash";
import { deleteVisitor } from "@/app/admin/chats-actions";
import { KeyNav, Logo } from "./live";
import { ago, Empty, Panel, stamp, workDomain } from "./ui";
import { DayCells, Ico, Sigil } from "./viz";

const TYPES: [string, string][] = [["", "any"], ["business", "business"], ["edu", "university"], ["isp", "home / isp"], ["hosting", "hosting / vpn"]];
const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : null; } catch { return null; } };

/** Their employer's logo when their email names it, else their sigil. */
function Face({ v, size = 36 }: { v: VisitorRow; size?: number }) {
  const sigil = <Sigil id={v.id} size={size} />;
  const d = workDomain(v.email);
  return d ? <span className="d-logo-big" style={{ width: size, height: size }}><Logo host={d} fallback={sigil} /></span> : sigil;
}

/** Key events as small glyphs with counts: asked the agent, sent an email, opened the resume, identified. */
function KeyEvents({ k }: { k: Record<string, number> }) {
  const items: [string, string, string, number][] = [
    ["ask", "a", "questions to the agent", k.agent_turn ?? 0], ["mail", "m", "emails sent", k.composer_send ?? 0],
    ["resume", "", "resume opens", k.resume ?? 0], ["case", "", "case studies opened", k.overlay ?? 0], ["id", "i", "identified", k.identify ?? 0],
  ];
  const on = items.filter(([, , , n]) => n > 0);
  if (!on.length) return <span className="d-keyev"><span>browsed</span></span>;
  return <span className="d-keyev">{on.map(([icon, cls, label, n]) => <span key={icon} className={cls} title={`${n} ${label}`}><Ico name={icon} label={label} />{n}</span>)}</span>;
}

/** /admin/visitors: everyone tracked (bots hidden), most recently seen first, paginated; GET filters; j/k + Enter. */
export function VisitorsView({ rows, total, f, base, now, pageSize, activity }: {
  rows: VisitorRow[]; total: number; f: VisitorQuery; base: string; now: number; pageSize: number; activity: Record<string, Activity>;
}) {
  const qs = (o: Partial<VisitorQuery>) => {
    const m = { ...f, page: 0, ...o };
    return `${base}/visitors?${new URLSearchParams({ ...(m.q && { q: m.q }), ...(m.country && { country: m.country }), ...(m.type && { type: m.type }), ...(m.identified && { identified: "1" }), ...(m.page && { page: String(m.page) }) })}`;
  };
  const days = Array<number>(30).fill(0);
  for (const a of Object.values(activity)) a.days.forEach((n, i) => { days[i] += n; });
  const max = Math.max(1, ...days);
  return (
    <main className="d-main tight">
      <header className="d-listhead">
        <h1>Visitors<small>{total.toLocaleString("en-US")} people</small></h1>
        <div className="d-histw">
          <span className="d-hist" role="img" aria-label="Visits per day by the people on this page, last 30 days">
            {days.map((v, i) => <i key={i} className={v ? undefined : "z"} style={{ height: v ? `${Math.max(8, (v / max) * 100)}%` : undefined, ["--i" as string]: i } as CSSProperties} />)}
          </span>
          visits on this page · 30 days
        </div>
      </header>
      <form className="d-cmd" action={`${base}/visitors`} role="search">
        <span aria-hidden="true">❯</span>
        <label className="sr-only" htmlFor="vq">Search visitors</label>
        <input id="vq" type="search" name="q" defaultValue={f.q} placeholder="name, email, company, network, city" />
        <label className="sr-only" htmlFor="vc">Country code</label>
        <input id="vc" name="country" defaultValue={f.country} placeholder="cc" maxLength={2} size={3} />
        {f.type && <input type="hidden" name="type" value={f.type} />}
        <div className="d-toggles"><label><input type="checkbox" name="identified" value="1" defaultChecked={f.identified} />identified</label></div>
        <button type="submit">filter</button>
      </form>
      <nav className="d-toggles" aria-label="Network type">
        {TYPES.map(([v, l]) => <a key={v} href={qs({ type: v })} aria-current={f.type === v ? "true" : undefined}>{l}</a>)}
        <span className="d-keys" style={{ marginLeft: "auto", alignSelf: "center" }}><kbd>j</kbd> <kbd>k</kbd> move · <kbd>enter</kbd> open · <kbd>/</kbd> search</span>
      </nav>
      {rows.length ? (
        <KeyNav>
          <ul className="d-rows">
            {rows.map((v, i) => {
              const a = activity[v.id];
              const who = whoLabel(v);
              const sub = [v.email && v.email !== who ? v.email : null, (v.company_given || v.company) !== who ? v.company_given || v.company : null, v.ip_type].filter(Boolean).join(" · ");
              return (
                <li key={v.id}>
                  <a className="d-row d-visrow" data-row href={`${base}/visitors/${v.id}`} style={{ ["--i" as string]: i } as CSSProperties}>
                    <Face v={v} />
                    <span className="main">
                      <b>{who === "anonymous" ? <span style={{ color: "var(--muted)" }}>anonymous</span> : who}</b>
                      <span>
                        {v.device && <Ico name={v.device} label={v.device} />}
                        {v.country && <span className="d-cc">{v.country}</span>}
                        <span className="t">{[v.city, sub].filter(Boolean).join(" · ") || "–"}</span>
                      </span>
                    </span>
                    <span className="act">{a ? <DayCells days={a.days} /> : <span className="d-keys">no recent visits</span>}<KeyEvents k={a?.keys ?? {}} /></span>
                    <span className="meta">{v.visits} visit{v.visits === 1 ? "" : "s"}<small>{host(v.first_referrer) ?? "direct"}</small></span>
                    <span className="when">{ago(v.last_seen, now)}</span>
                  </a>
                  <Trash id={v.id} action={deleteVisitor} what="visitor, their visits, replays and chats" />
                </li>
              );
            })}
          </ul>
        </KeyNav>
      ) : <Empty>No visitors match. Every browser that opens the site appears here (bots are hidden). Try clearing the filters.</Empty>}
      <div className="d-pager">
        {f.page > 0 ? <a href={qs({ page: f.page - 1 })}>← newer</a> : <span />}
        <span>page {f.page + 1} of {Math.max(1, Math.ceil(total / pageSize))}</span>
        {(f.page + 1) * pageSize < total ? <a href={qs({ page: f.page + 1 })}>older →</a> : <span />}
      </div>
    </main>
  );
}

/** Which mark an event gets on a visit track. */
function kindOf(t: string): string {
  if (t === "section" || t === "scroll") return "sec";
  if (t === "pageview") return "page";
  if (t === "agent_open" || t === "agent_turn") return "ask";
  if (t === "composer_open" || t === "composer_send") return "mail";
  if (t === "outbound") return "go";
  if (t === "identify") return "id";
  if (t === "error") return "err";
  return "misc";
}
const SKIP = new Set(["active", "perf"]);
const KEY = new Set(["agent_open", "agent_turn", "composer_open", "composer_send", "resume", "identify", "outbound", "design"]);

/** One visit: a track with a glyph per event at its moment; opens into the event list and the replay player. */
function Visit({ v, events, seqs, open, replay, i }: { v: VisitRow; events: EventRow[]; seqs: number[]; open: boolean; replay?: unknown[]; i: number }) {
  const t0 = Date.parse(v.started_at), span = Math.max(1, Date.parse(v.ended_at) - t0);
  const reach = Math.max(1000, ...events.map((e) => Date.parse(e.at) - t0)); // the track ends at the last event, so an idle tail does not squash it
  const active = events.filter((e) => e.type === "active").reduce((s, e) => s + (Number(e.data?.ms) || 0), 0);
  const shown = events.filter((e) => !SKIP.has(e.type));
  return (
    <details className="d-visit" open={open} style={{ ["--i" as string]: i } as CSSProperties}>
      <summary>
        <span className="when">{stamp(v.started_at).slice(5, 16)}<small>{duration(span)} · {duration(active)} active</small></span>
        <span className="d-track" role="img" aria-label={`${shown.length} events: ${shown.filter((e) => KEY.has(e.type)).map((e) => e.type.replace("_", " ")).join(", ") || "browsing"}`}>
          {shown.map((e) => {
            const o = Math.min(1, Math.max(0, (Date.parse(e.at) - t0) / reach));
            return <i key={e.id} className={`k-${kindOf(e.type)}`} style={{ left: `${o * 100}%`, ["--o" as string]: o } as CSSProperties} title={`${offset(v.started_at, e.at)} ${describeEvent(e)}`} />;
          })}
        </span>
        <span className="chips">
          {v.design && <span className="d-chip pink">{v.design}</span>}
          {host(v.referrer) && <span className="d-chip">{host(v.referrer)}</span>}
          {v.viewport && <span className="d-chip dim">{v.viewport}</span>}
        </span>
      </summary>
      <div className="d-visit-body">
        <p className="d-visit-meta">from {v.referrer || "direct"}{v.utm ? ` · ${Object.values(v.utm).join(" / ")}` : ""} · landed on {v.entry_url ?? "/"} · ip {v.ip ?? "–"} · {v.tz ?? "–"} · {v.lang ?? "–"}</p>
        {(seqs.length > 0 || replay) && <ReplayPlayer visitId={v.id} seqs={seqs} events={replay} />}
        {events.length ? (
          <ol className="d-tl">
            {events.map((e) => (
              <li key={e.id}>
                <time dateTime={e.at}>{offset(v.started_at, e.at)}</time>
                <span className={`g${e.type === "error" ? " bad" : KEY.has(e.type) ? " key" : ""}`} aria-hidden="true">{e.type === "error" ? "×" : KEY.has(e.type) ? "●" : "·"}</span>
                <span className="what"><em>{e.type}</em>{describeEvent(e)}</span>
              </li>
            ))}
          </ol>
        ) : <Empty>No events in this visit.</Empty>}
      </div>
    </details>
  );
}

/** /admin/visitors/<id>: who they are, every visit as a track, their conversations as agent-window replicas. */
export function VisitorInspector({ v, visits, chats, messages, base, now, replay }: {
  v: VisitorRow; visits: (VisitRow & { events: EventRow[]; replaySeqs: number[] })[]; chats: ChatLink[]; messages: Map<string, MessageRow[]>;
  base: string; now: number; replay?: unknown[];
}) {
  const who = whoLabel(v);
  const groups: [string, [string, string | null | undefined][]][] = [
    ["who", [["name", v.name], ["email", v.email], ["company (told)", v.company_given], ["identified", v.identified_at ? stamp(v.identified_at) : null]]],
    ["network", [["company (network)", v.company], ["owner", v.org], ["type", v.ip_type], ["asn", v.asn]]],
    ["device", [["device", v.device], ["browser", v.browser], ["os", v.os], ["screen", v.screen], ["languages", v.languages]]],
    ["origin", [["place", place(v) === "—" ? null : place(v)], ["country", v.country ? countryName(v.country) : null], ["timezone", v.timezone], ["first from", v.first_referrer],
      ["first utm", v.first_utm ? Object.entries(v.first_utm).map(([k, x]) => `${k.replace("utm_", "")}=${x}`).join(" ") : null]]],
  ];
  const raw: [string, string][] = [["first seen", stamp(v.first_seen)], ["last seen", stamp(v.last_seen)], ["ips", v.ips.join(", ")], ["user agent", v.user_agent ?? "–"], ["visitor id", v.id]];
  return (
    <main className="d-main tight">
      <a className="d-back" href={`${base}/visitors`}>← visitors</a>
      <header className="d-who">
        <Face v={v} size={72} />
        <div>
          <h1>{who}</h1>
          <p>
            {(v.company_given || v.company) && (v.company_given || v.company) !== who && <span>{v.company_given || v.company}</span>}
            {place(v) !== "—" && <span>{place(v)}</span>}
            <span>{v.visits} visit{v.visits === 1 ? "" : "s"}</span>
            <span>seen {ago(v.last_seen, now)} ago</span>
          </p>
        </div>
        <div className="d-acts">
          {chats[0] && <a href={`${base}/chats/${chats[0].id}`}>latest chat</a>}
          {v.email && <a href={`mailto:${v.email}`}>email</a>}
        </div>
      </header>

      <Panel label="profile">
        <div className="d-facts">
          {groups.map(([g, fields]) => {
            const shown = fields.filter(([, x]) => x);
            return (
              <dl key={g} aria-label={g}>
                {shown.length ? shown.map(([k, x]) => <div key={k}><dt>{k}</dt><dd>{x}</dd></div>) : <div><dt>{g}</dt><dd style={{ color: "var(--dim)" }}>–</dd></div>}
              </dl>
            );
          })}
        </div>
        <details className="d-raw" style={{ marginTop: 18 }}>
          <summary>raw</summary>
          <dl>{raw.map(([k, x]) => <Fragment key={k}><dt>{k}</dt><dd>{x}</dd></Fragment>)}</dl>
        </details>
      </Panel>

      <section className="d-sec" aria-labelledby="vs-h">
        <header className="d-sec-h"><span className="d-idx">01</span><h2 id="vs-h">Visits</h2><span className="d-rule" />
          <span className="d-sec-m d-tleg"><i className="k-page" />page<i className="k-ask" />agent<i className="k-mail" />email<i className="k-go" />left<i className="k-id" />identified<i className="k-err" />error</span></header>
        {visits.length ? <div>{visits.map((x, i) => <Visit key={x.id} v={x} events={x.events} seqs={x.replaySeqs} open={i === 0} replay={i === 0 ? replay : undefined} i={i} />)}</div> : <Empty>No visits recorded.</Empty>}
      </section>

      <section className="d-sec" aria-labelledby="c-h">
        <header className="d-sec-h"><span className="d-idx">02</span><h2 id="c-h">Chats</h2><span className="d-rule" /></header>
        {chats.length ? (
          <div className="d-replicas">
            {chats.map((c) => (
              <div key={c.id} style={{ display: "grid", gap: 8, minWidth: 0 }}>
                <ChatReplica messages={messages.get(c.id) ?? []} short footer={`${stamp(c.created_at)} · ${c.visit_turns} question${c.visit_turns === 1 ? "" : "s"}`} />
                <a className="d-back" href={`${base}/chats/${c.id}`}>open conversation →</a>
              </div>
            ))}
          </div>
        ) : <Empty>No conversations with the agent from this browser.</Empty>}
      </section>
    </main>
  );
}
