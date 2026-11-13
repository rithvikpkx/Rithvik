import { redactPII } from "@/lib/agent/obs";
import type { MessageRow } from "@/lib/agent/chats";

/** Compact timestamp for tables and message headers (UTC, so server and browser agree). */
export function stamp(iso: string): string {
  return iso.slice(0, 16).replace("T", " ") + " UTC";
}

/** Pretty-printed JSON for the tool and source disclosure blocks. */
function json(v: unknown): string {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

/** Owner view of a transcript: every row with role, tool and source details, and per-turn model telemetry. */
export function AdminMessages({ messages }: { messages: MessageRow[] }) {
  return (
    <ol className="alog-msgs" aria-label="Transcript">
      {messages.map((m) => {
        const stats = [
          m.model,
          m.tokens_in != null || m.tokens_out != null ? `${m.tokens_in ?? "?"} in / ${m.tokens_out ?? "?"} out tokens` : null,
          m.ttfb_ms != null ? `ttfb ${m.ttfb_ms} ms` : null,
          m.total_ms != null ? `total ${m.total_ms} ms` : null,
          m.status != null && m.status !== 200 ? `status ${m.status}` : null,
          m.cached ? "cached" : null,
        ].filter(Boolean);
        return (
          <li key={m.id} className="alog-msg" data-role={m.role}>
            <div className="alog-role">
              <b>{m.role === "user" ? "Visitor" : m.role === "assistant" ? "Agent" : "Tool"}</b>
              <time dateTime={m.created_at}>{stamp(m.created_at)}</time>
              {stats.length > 0 && <span className="alog-mono">{stats.join(" · ")}</span>}
            </div>
            {m.content && <div className="alog-body">{m.content}</div>}
            {m.error && <p className="alog-err">Error: {m.error}</p>}
            {m.tools != null && <details><summary>Tool use</summary><pre>{json(m.tools)}</pre></details>}
            {m.sources != null && <details><summary>Sources</summary><pre>{json(m.sources)}</pre></details>}
          </li>
        );
      })}
    </ol>
  );
}

/** Public view for a share link: visitor and agent text only, with emails and phone numbers masked. */
export function SharedMessages({ messages }: { messages: { role: "user" | "assistant"; content: string }[] }) {
  return (
    <ol className="alog-msgs" aria-label="Conversation">
      {messages.map((m, i) => (
        <li key={i} className="alog-msg" data-role={m.role}>
          <div className="alog-role"><b>{m.role === "user" ? "Visitor" : "Agent"}</b></div>
          <div className="alog-body">{redactPII(m.content)}</div>
        </li>
      ))}
    </ol>
  );
}
