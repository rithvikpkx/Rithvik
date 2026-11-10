import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorInspector } from "@/components/admin/People";
import type { MessageRow } from "@/lib/agent/chats";
import { messagesFor } from "@/lib/analytics/server";
import { getVisitor } from "@/lib/track/query";

export const metadata = { title: "Visitor" };

/** /admin/visitors/<id>: one visitor's profile, every visit as an event track with replay, and their chats as replicas. */
export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const found = await getVisitor((await params).id);
  if (!found) notFound();
  const messages = (await messagesFor(found.chats.map((c) => c.id))) as unknown as Map<string, MessageRow[]>;
  return (
    <AdminFrame tab="visitors" live={false}>
      <VisitorInspector v={found.visitor} visits={found.visits} chats={found.chats} messages={messages} base="/admin" now={Date.now()} />
    </AdminFrame>
  );
}
