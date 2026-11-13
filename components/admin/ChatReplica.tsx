"use client";
import "@/components/site/agent/agent.css";
import "@/components/site/charts/charts.css";
import { useMemo } from "react";
import Transcript, { type RowHandlers } from "@/components/site/agent/Transcript";
import { Icon } from "@/components/site/Glyph";
import { rowsToItems } from "@/lib/analytics/replica";
import type { MessageRow } from "@/lib/agent/chats";

// Read-only: the visitor's controls render as they saw them but do nothing here (copy still copies).
const H: RowHandlers = {
  send: () => {}, fill: () => {}, press: () => {}, undo: () => {}, cite: () => {},
  copy: (t) => { navigator.clipboard?.writeText(t).catch(() => {}); },
};

/** A conversation replayed in the agent's own window (same markup, CSS and Transcript component as the site), scrollable,
 *  with a footer instead of the prompt. Answers carry a muted telemetry line the visitor never saw. */
export default function ChatReplica({ messages, model, title, footer, short }: { messages: MessageRow[]; model?: string; title?: string; footer?: string; short?: boolean }) {
  const items = useMemo(() => rowsToItems(messages), [messages]);
  return (
    <div className="adm-replica">
      <div className="agent">
        <section className={`agent-panel${short ? " short" : ""}`} aria-label={title ?? "Conversation replica"}>
          <header className="agent-head">
            <span className="agent-title"><span className="at-mark" aria-hidden="true">✻</span> RAG</span>
            <span className="agent-model">{model}</span>
            <span className="agent-actions">
              <button type="button" className="ag-btn" aria-label="Copy transcript" title="Copy transcript"
                onClick={() => H.copy(messages.filter((m) => m.role !== "tool").map((m) => `${m.role === "user" ? "> " : ""}${m.content}`).join("\n\n"))}>
                <Icon name="copy" />
              </button>
            </span>
          </header>
          <div className="agent-log" role="log" tabIndex={0} aria-label="Transcript">
            {items.length ? <Transcript items={items} h={H} /> : <p className="t-tips">No messages in this conversation.</p>}
          </div>
          <div className="adm-replica-foot"><span aria-hidden="true">❯</span>{footer ?? "Read-only replica"}</div>
        </section>
      </div>
    </div>
  );
}
