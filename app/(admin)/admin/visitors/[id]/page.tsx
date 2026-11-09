import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorInspector } from "@/components/admin/People";
import type { MessageRow } from "@/lib/agent/chats";
import { currentLook, messagesFor } from "@/lib/analytics/server";
import { getVisitor } from "@/lib/track/query";

export const metadata = { title: "Visitor" };

/** /admin/visitors/<id>: one visitor's full profile, their chats as agent-window replicas, and every visit with events and replay. */
export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const [{ look, font, fonts, now }, found] = await Promise.all([currentLook(), getVisitor((await params).id)]);
  if (!found) notFound();
  const messages = (await messagesFor(found.chats.map((c) => c.id))) as unknown as Map<string, MessageRow[]>;
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="visitors">
        <VisitorInspector v={found.visitor} visits={found.visits} chats={found.chats} messages={messages} base="/admin" now={now} />
      </AdminFrame>
    </>
  );
}
