import "@/components/agent-log/log.css";
import { AdminMessages, SharedMessages } from "@/components/agent-log/Messages";
import { FilterForm, SessionMeta, SessionTable } from "@/components/agent-log/SessionViews";
import type { MessageRow, SessionRow } from "@/lib/agent/chats";
import type { SessionSummary } from "@/lib/agent/chats-query";

const session: SessionRow = {
  id: "123e4567-e89b-12d3-a456-426614174000", created_at: "2026-11-09T14:02:11Z", last_at: "2026-11-09T14:09:40Z",
  country: "US", region: "CA", city: "San Francisco", user_agent: "Mozilla/5.0 (Macintosh) Safari/605", referrer: "https://www.linkedin.com/",
  first_design: "nimbus", visitor_name: "Ada Recruiter", visitor_email: "ada@acme.example", visitor_company: "Acme", share_token: "AbCdEfGhIjKlMnOpQrStUv",
  share_expires_at: "2026-12-09T14:09:40Z", follow_up: true, notes: "Strong fit for the BCI role.",
};
const rows: SessionSummary[] = [
  { ...session, turns: 4, preview: "What has he built with computer vision? I am hiring for a perception team and want details." },
  { ...session, id: "223e4567-e89b-12d3-a456-426614174000", visitor_name: null, visitor_email: null, follow_up: false, share_token: null, city: null, region: null, country: "IN", turns: 1, preview: "hi" },
];
const base = { tokens_in: null, tokens_out: null, ttfb_ms: null, total_ms: null, status: null, error: null, cached: false, tools: null, sources: null, model: null };
const messages: MessageRow[] = [
  { ...base, id: 1, created_at: "2026-11-09T14:02:12Z", role: "user", content: "Can I reach him? My number is +1 (415) 555-0132, email ada@acme.example." },
  { ...base, id: 2, created_at: "2026-11-09T14:02:13Z", role: "tool", content: "", tools: { name: "search_projects", args: { q: "vision" } } },
  { ...base, id: 3, created_at: "2026-11-09T14:02:15Z", role: "assistant", content: "Yes: rithvikpkx@gmail.com. Here is what he built.", model: "gpt-5.4-mini", tokens_in: 1820, tokens_out: 210, ttfb_ms: 640, total_ms: 2210, status: 200, sources: [{ title: "Boiler Frame", href: "/work/boiler-frame" }] },
  { ...base, id: 4, created_at: "2026-11-09T14:03:00Z", role: "assistant", content: "", status: 502, error: "upstream timeout", model: "gpt-5.4-mini" },
];

/** /lab/chats: the admin chat views and the public share view on fixture rows (the real pages need a login). */
export default function ChatsLab() {
  return (
    <main className="alog">
      <div className="alog-wrap">
        <h1>Lab: admin chats (fixtures)</h1>
        <FilterForm f={{ q: "vision", email: true, followUp: false, from: "2026-11-01", to: null }} />
        <SessionTable rows={rows} base="/lab/chats" />
        <h2>Session view</h2>
        <SessionMeta s={session} />
        <AdminMessages messages={messages} />
        <h2>Share view (redacted)</h2>
        <SharedMessages messages={messages.filter((m) => m.role !== "tool").map((m) => ({ role: m.role as "user" | "assistant", content: m.content })).filter((m) => m.content)} />
      </div>
    </main>
  );
}
