"use client";
import { memo, useEffect, useRef, useState } from "react";
import { COMMANDS, runsOnClick } from "@/lib/agent/commands";
import { STARTER_QUESTIONS } from "@/lib/agent/starters";
import SimpleMarkdown from "@/components/SimpleMarkdown";
import { Icon } from "../Glyph";
import ArtifactView from "../charts/ArtifactView";
import StartBlock from "./StartBlock";
import type { Item } from "./types";

export type RowHandlers = {
  send: (q: string) => void; // welcome chips: send now
  fill: (q: string) => void; // suggestion chips: fill the input, never send
  press: (rowId: number, buttonId: number) => void; // an action button: the only way a side effect runs
  undo: (id: number) => void;
  copy: (text: string) => void;
  cite: (anchor: string) => void; // footnote click: scroll to + highlight the source
};

const STARTERS = [...STARTER_QUESTIONS, "/theme random"];

/** True when motion should be skipped (performance mode or reduced motion): text then appears as it arrives. */
const instant = () => document.documentElement.classList.contains("lite") || matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Reveals a streaming answer at a typed cadence. The reveal speeds up with the backlog (an eighth of it per frame),
 *  so it never falls noticeably behind the stream; once the stream ends the full text shows. */
function useTyped(text: string, live: boolean): string {
  const [n, setN] = useState(0);
  const target = useRef(text);
  useEffect(() => { target.current = text; });
  useEffect(() => {
    if (!live || instant()) return;
    let raf = 0;
    const tick = () => {
      setN((c) => { const len = target.current.length; return c < len ? c + Math.max(1, Math.ceil((len - c) / 8)) : c; });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [live]);
  return live && !instant() ? text.slice(0, n) : text;
}

/** One answer row: markdown over the typed reveal, copy button once it is done. */
function Answer({ text, streaming, onCopy }: { text: string; streaming: boolean; onCopy: (t: string) => void }) {
  const shown = useTyped(text, streaming);
  return (
    <div className="t-line">
      <span className={`t-dot${streaming ? " live" : ""}`} aria-hidden="true" />
      <div className={`t-body${streaming ? " caret" : ""}`}><SimpleMarkdown text={shown} /></div>
      {!streaming && (
        <div className="t-acts">
          <button type="button" aria-label="Copy answer" title="Copy" onClick={() => onCopy(text)}><Icon name="copy" /></button>
        </div>
      )}
    </div>
  );
}

const Row = memo(function Row({ item, h, projects, roles, first }: { item: Item; h: RowHandlers; projects: number; roles: number; first: boolean }) {
  switch (item.kind) {
    case "banner":
      return (
        <>
          <StartBlock model={process.env.NEXT_PUBLIC_CHAT_MODEL} projects={projects} roles={roles} />
          {first && (
            <div className="t-starters">
              {STARTERS.map((s) => <button key={s} type="button" className="t-chip" onClick={() => h.send(s)}>{s}</button>)}
            </div>
          )}
        </>
      );
    case "user":
      return <p className="t-user">{item.text}</p>;
    case "tool":
      return (
        <div className="t-line">
          <span className="t-dot" aria-hidden="true" />
          <span className="t-tool"><b>{item.name}</b><span className="args">({item.args})</span></span>
          {item.result !== undefined && (
            <span className="t-res">
              {item.result}
              {item.undo && <button type="button" className="t-key inline" onClick={() => h.undo(item.id)}>u Undo</button>}
            </span>
          )}
          {item.lines && (
            <dl className="t-facts">{item.lines.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          )}
        </div>
      );
    case "help":
      return (
        <div className="t-line">
          <span className="t-dot" aria-hidden="true" />
          <div className="t-body">
            <ul className="t-cmds" aria-label="Commands">
              {COMMANDS.map(([c, d]) => (
                <li key={c}>
                  <button type="button" className="t-chip" title={runsOnClick(c) ? `Run ${c}` : `Fill ${c}`} onClick={() => (runsOnClick(c) ? h.send(c) : h.fill(`${c} `))}>{c}</button> {d}
                </li>
              ))}
            </ul>
            <p className="t-tips">Cmd+K or / to summon · up arrow for earlier prompts · esc interrupts, then closes · Cmd+Enter full screen · Ctrl+L clear · Ctrl+U clear line</p>
          </div>
        </div>
      );
    case "answer":
      return <Answer text={item.text} streaming={item.streaming} onCopy={h.copy} />;
    case "artifact":
      return <ArtifactView spec={item.spec} />;
    case "suggest":
      return (
        <div className="t-sugg">
          {item.chips.map((c) => <button key={c} type="button" className="t-chip sugg" title={c} onClick={() => h.fill(c)}>{c}</button>)}
        </div>
      );
    case "actions":
      return (
        <div className="t-acts-row" role="group" aria-label="Actions">
          {item.detail && <ul className="t-detail" aria-label="What will be sent">{item.detail.map((d) => <li key={d}>{d}</li>)}</ul>}
          <div className="t-buttons">
            {item.buttons.map((b) => (
              <button key={b.id} type="button" className="t-chip act" data-done={b.clicked || undefined} disabled={b.once && b.clicked}
                onClick={() => h.press(item.id, b.id)}>{b.label}</button>
            ))}
          </div>
        </div>
      );
    case "sources":
      return (
        <ol className="t-sources" aria-label="Sources">
          {item.items.map((s) => (
            <li key={s.n}>
              <span className="n">[{s.n}]</span>{" "}
              {s.anchor ? <button type="button" onClick={() => h.cite(s.anchor!)} title="Show on the page">{s.label}</button> : s.label}
            </li>
          ))}
        </ol>
      );
    case "note":
      return <p className={`t-interrupted${item.tone === "warn" ? " warn" : ""}`}>{item.text}</p>;
  }
});

/** The scrolling log: one memoised row per item so only the streaming answer re-renders per chunk. */
export default function Transcript({ items, h, projects, roles }: { items: Item[]; h: RowHandlers; projects: number; roles: number }) {
  return <>{items.map((it) => <Row key={it.id} item={it} h={h} projects={projects} roles={roles} first={items.length === 1} />)}</>;
}
