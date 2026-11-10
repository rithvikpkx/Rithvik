import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import { saveNotes, setFollowUp } from "@/app/admin/chats-actions";
import AdminFrame from "@/components/admin/AdminFrame";
import { ChatView } from "@/components/admin/Chats";
import { getSession } from "@/lib/agent/chats-query";

export const metadata = { title: "Chat" };

/** /admin/chats/<id>: one conversation as a trace + a replica of the agent window, with follow-up and notes. Admin only. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const found = await getSession((await params).id);
  if (!found) notFound();
  const visitorId = (found.session as { visitor_id?: string | null }).visitor_id ?? null;
  return (
    <AdminFrame tab="chats" live={false}>
      <ChatView s={found.session} messages={found.messages} base="/admin" visitorId={visitorId} actions={{ setFollowUp, saveNotes }} />
    </AdminFrame>
  );
}
