import AdminFrame from "@/components/admin/AdminFrame";
import { ChatsView } from "@/components/admin/Chats";
import { fixtureChats } from "@/lib/track/fixture";
import { fontVars, labLook } from "../look";

/** /lab/dashboard/chats: the conversations list on fixture rows (local only). */
export default async function ChatsLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { look, font, fonts } = await labLook(await searchParams);
  const base = { last_at: "2026-11-09T14:05:00Z", user_agent: "Mozilla/5.0 (Macintosh) Chrome/130", share_token: null, share_expires_at: null, notes: null, follow_up: false, visitor_name: null, visitor_email: null, visitor_company: null };
  const rows = [
    { ...base, id: fixtureChats[0].id, created_at: "2026-11-09T14:03:20Z", country: "US", region: "CA", city: "San Francisco", referrer: "https://www.linkedin.com/", first_design: "nimbus", visitor_name: "Ada Recruiter", visitor_email: "ada@acme.example", visitor_company: "Acme", follow_up: true, turns: 3, preview: "Does he have computer vision experience?" },
    { ...base, id: "223e4567-e89b-12d3-a456-426614174999", created_at: "2026-11-09T11:40:00Z", country: "IN", region: "KA", city: "Bengaluru", referrer: null, first_design: "glyph", turns: 2, preview: "What has he built?" },
    { ...base, id: "323e4567-e89b-12d3-a456-426614174999", created_at: "2026-11-08T21:02:00Z", country: "US", region: "IN", city: "West Lafayette", referrer: "https://github.com/", first_design: "dracula", share_token: "x", turns: 5, preview: "Is he available for a summer 2027 internship?" },
  ];
  return (
    <div className={fontVars}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="chats" base="/lab/dashboard">
        <ChatsView rows={rows} f={{ q: "", email: false, followUp: false, from: null, to: null }} base="/lab/dashboard" now={Date.UTC(2026, 10, 9, 18)} />
      </AdminFrame>
    </div>
  );
}
