import AdminFrame from "@/components/admin/AdminFrame";
import { ChatsView } from "@/components/admin/Chats";
import { fixtureMessages } from "@/lib/analytics/fixture";
import { sessionStrip } from "@/lib/analytics/strips";
import { fixtureChats } from "@/lib/track/fixture";
import { fontVars, labGuard } from "../look";

const NOW = Date.UTC(2026, 10, 9, 18);
const at = (h: number, m = 0) => new Date(NOW - h * 3_600_000 - m * 60_000).toISOString();
const base = { last_at: at(0), user_agent: "Mozilla/5.0 (Macintosh) Chrome/130", share_token: null, share_expires_at: null, notes: null, follow_up: false, visitor_name: null, visitor_email: null, visitor_company: null, referrer: null, region: null, city: null };
const rows = [
  { ...base, id: fixtureChats[0].id, created_at: at(3, 40), country: "US", region: "CA", city: "San Francisco", referrer: "https://www.linkedin.com/", first_design: "nimbus", visitor_name: "Ada Recruiter", visitor_email: "ada@anduril.com", visitor_company: "Anduril", follow_up: true, turns: 3, preview: "Does he have computer vision experience?" },
  { ...base, id: "223e4567-e89b-12d3-a456-426614174999", created_at: at(6, 20), country: "IN", city: "Bengaluru", first_design: "glyph", turns: 2, preview: "What has he built?" },
  { ...base, id: "323e4567-e89b-12d3-a456-426614174999", created_at: at(21), country: "US", city: "West Lafayette", referrer: "https://github.com/", first_design: "dracula", share_token: "x", turns: 5, preview: "Is he available for a summer 2027 internship?" },
  { ...base, id: "423e4567-e89b-12d3-a456-426614174999", created_at: at(26), country: "GB", city: "London", referrer: "https://news.ycombinator.com/", first_design: "mercury", turns: 1, preview: "Who won the world cup?" },
  { ...base, id: "523e4567-e89b-12d3-a456-426614174999", created_at: at(50), country: "US", city: "Seattle", first_design: "classic", visitor_name: "Jordan Chen", visitor_email: "jordan@stripe.com", turns: 4, preview: "Can I book a call with him next week?" },
  { ...base, id: "623e4567-e89b-12d3-a456-426614174999", created_at: at(98), country: "DE", city: "Berlin", first_design: "foil", turns: 2, preview: "Tell me about the brain-computer interface work" },
];
/** Varied strips from the fixture transcript: trimmed, with a cache hit or a failure here and there. */
const strips = Object.fromEntries(rows.map((r, i) => {
  const msgs = fixtureMessages.slice(0, Math.max(3, Math.min(9, r.turns * 3))).map((m, j) => ({
    ...m, cached: m.role === "assistant" && (i + j) % 4 === 0, status: m.role === "assistant" && i === 3 ? 502 : m.status,
  }));
  return [r.id, sessionStrip(msgs)];
}));

/** /lab/dashboard/chats: the conversations list on fixture rows (local only). */
export default function ChatsLab() {
  labGuard();
  return (
    <div className={fontVars}>
      <AdminFrame tab="chats" base="/lab/dashboard" live={false}>
        <ChatsView rows={rows} f={{ q: "", email: false, followUp: false, from: null, to: null }} base="/lab/dashboard" now={NOW} strips={strips} />
      </AdminFrame>
    </div>
  );
}
