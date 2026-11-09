"use client";
import { memo } from "react";
import { COMMANDS } from "@/lib/agent/commands";
import { STARTER_QUESTIONS } from "@/lib/agent/starters";
import SimpleMarkdown from "@/components/SimpleMarkdown";
import { Icon } from "../Glyph";
import ArtifactView from "../charts/ArtifactView";
import type { Choice, Item } from "./types";

export type RowHandlers = {
  send: (q: string) => void; // welcome chips: send now
  fill: (q: string) => void; // suggestion chips: fill the input, never send
  answer: (id: number, c: Choice) => void;
  undo: (id: number) => void;
  copy: (text: string) => void;
  cite: (anchor: string) => void; // footnote click: scroll to + highlight the source
};

const STARTERS = [...STARTER_QUESTIONS, "/theme random"];
const ASK_DONE: Record<string, string> = { yes: "Allowed", no: "Skipped", always: "Allowed for this session", auto: "Allowed for this session" };

/** Welcome box: rows are padded to a fixed width so the box-drawing frame lines up in a mono font. */
function banner(projects: number, roles: number): string {
  const W = 36;
  const rows = ["✻ RAG · Rithvik Augmented Generation", `  grounded in ${projects} projects + ${roles} roles`, "  /help · esc to interrupt"];
  const pad = (t: string) => t + " ".repeat(Math.max(0, W - [...t].length));
  return `╭${"─".repeat(W + 2)}╮\n${rows.map((r) => `│ ${pad(r)} │`).join("\n")}\n╰${"─".repeat(W + 2)}╯`;
}

/** Wraps the mark and /help in accent spans without ever touching the text itself. */
function accent(box: string) {
  return box.split(/(✻|\/help|RAG)/).map((p, i) => (p === "✻" || p === "/help" || p === "RAG" ? <span key={i} className="acc">{p}</span> : p));
}

const Row = memo(function Row({ item, h, projects, roles, first }: { item: Item; h: RowHandlers; projects: number; roles: number; first: boolean }) {
  switch (item.kind) {
    case "banner":
      return (
        <>
          <pre className="agent-banner">{accent(banner(projects, roles))}</pre>
          <p className="t-tips">Try &quot;what has he built?&quot;, /resume or /theme random</p>
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
          <span className="t-dot" aria-hidden="true">⏺</span>
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
          <span className="t-dot" aria-hidden="true">⏺</span>
          <div className="t-body">
            <p>{COMMANDS.map(([c, d]) => <span key={c}><code>{c}</code> {d}<br /></span>)}</p>
            <p className="t-tips">Cmd+K or / to summon · up arrow for earlier prompts · esc interrupts, then closes · Cmd+Enter full screen · Ctrl+L clear · Ctrl+U clear line</p>
          </div>
        </div>
      );
    case "answer":
      return (
        <div className="t-line">
          <span className={`t-dot${item.streaming ? " live" : ""}`} aria-hidden="true">{item.streaming ? "○" : "⏺"}</span>
          <div className={`t-body${item.streaming ? " caret" : ""}`}><SimpleMarkdown text={item.text} /></div>
          {!item.streaming && (
            <div className="t-acts">
              <button type="button" aria-label="Copy answer" title="Copy" onClick={() => h.copy(item.text)}><Icon name="copy" /></button>
            </div>
          )}
        </div>
      );
    case "artifact":
      return <ArtifactView spec={item.spec} />;
    case "suggest":
      return (
        <div className="t-sugg">
          {item.chips.map((c) => <button key={c} type="button" className="t-chip sugg" title={c} onClick={() => h.fill(c)}>{c}</button>)}
        </div>
      );
    case "ask":
      return (
        <div className="t-line">
          <span className="t-dot" aria-hidden="true">⏺</span>
          {item.tool ? (
            <>
              <span className="t-tool"><b>{item.tool.name}</b><span className="args">({item.tool.args})</span></span>
              <span className="t-res">{item.question}</span>
            </>
          ) : (
            <span className="t-tool"><b>{item.question}</b></span>
          )}
          {item.detail && (
            <ul className="t-detail" aria-label="What will be sent">{item.detail.map((d) => <li key={d}>{d}</li>)}</ul>
          )}
          {item.state === "pending" ? (
            <div className="t-confirm">
              <button type="button" className="t-key primary" onClick={() => h.answer(item.id, "yes")}>{item.once ? "⏎ Send" : "⏎ Yes"}</button>
              <button type="button" className="t-key" onClick={() => h.answer(item.id, "no")}>{item.once ? "n Edit" : "n No"}</button>
              {!item.once && <button type="button" className="t-key" onClick={() => h.answer(item.id, "always")}>a Always this session</button>}
            </div>
          ) : (
            <span className="t-res">{item.once ? (item.state === "yes" ? "Confirmed" : "Not sent. Tell me what to change.") : ASK_DONE[item.state]}</span>
          )}
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
