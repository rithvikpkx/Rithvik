import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import { saveNotes, setFollowUp } from "@/app/admin/chats-actions";
import AdminFrame from "@/components/admin/AdminFrame";
import { ChatView } from "@/components/admin/Chats";
import { getSession } from "@/lib/agent/chats-query";
import { currentLook } from "@/lib/analytics/server";

export const metadata = { title: "Chat" };

/** /admin/chats/<id>: one conversation as a replica of the agent window, with follow-up and notes. Admin only. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const [{ look, font, fonts }, found] = await Promise.all([currentLook(), getSession((await params).id)]);
  if (!found) notFound();
  const visitorId = (found.session as { visitor_id?: string | null }).visitor_id ?? null;
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="chats">
        <ChatView s={found.session} messages={found.messages} base="/admin" visitorId={visitorId} actions={{ setFollowUp, saveNotes }} />
      </AdminFrame>
    </>
  );
}
