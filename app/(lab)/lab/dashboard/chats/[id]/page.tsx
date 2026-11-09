import AdminFrame from "@/components/admin/AdminFrame";
import { ChatView } from "@/components/admin/Chats";
import { fixtureMessages } from "@/lib/analytics/fixture";
import { fixtureChats, fixtureVisitor } from "@/lib/track/fixture";
import { fontVars, labLook } from "../../look";

/** /lab/dashboard/chats/<any>: one conversation as an agent-window replica on fixtures (local only). */
export default async function ChatLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { look, font, fonts } = await labLook(await searchParams);
  const s = {
    id: fixtureChats[0].id, created_at: "2026-11-09T14:03:20Z", last_at: "2026-11-09T14:05:00Z", country: "US", region: "CA", city: "San Francisco",
    user_agent: "Mozilla/5.0 (Macintosh) Chrome/130", referrer: "https://www.linkedin.com/", first_design: "nimbus", visitor_name: "Ada Recruiter",
    visitor_email: "ada@acme.example", visitor_company: "Acme Robotics", share_token: null, share_expires_at: null, follow_up: true, notes: "Recruiter at Acme; perception role.",
  };
  return (
    <div className={fontVars}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="chats" base="/lab/dashboard">
        <ChatView s={s} messages={fixtureMessages} base="/lab/dashboard" visitorId={fixtureVisitor.id} />
      </AdminFrame>
    </div>
  );
}
