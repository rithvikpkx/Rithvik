import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import { getVisitor } from "@/lib/track/query";
import { whoLabel } from "@/lib/track/views";
import { ChatList, VisitCard, VisitorMeta } from "@/components/visitor-log/VisitorViews";

export const metadata = { title: "Visitor" };

/** /admin/visitors/<id>: one visitor's identity, linked chats, and every visit with its event timeline and replay. Admin only. */
export default async function VisitorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const found = await getVisitor((await params).id);
  if (!found) notFound();
  const { visitor: v, visits, chats } = found;
  return (
    <main className="alog">
      <div className="alog-wrap">
        <div className="alog-top">
          <h1>{whoLabel(v)}</h1>
          <Link href="/admin/visitors">All visitors</Link>
        </div>
        <VisitorMeta v={v} />
        <h2>Agent conversations</h2>
        <ChatList chats={chats} />
        <h2>Visits</h2>
        {visits.length === 0 ? <p className="alog-muted">No visits recorded.</p> : visits.map((x) => (
          <VisitCard key={x.id} visit={x} events={x.events} replaySeqs={x.replaySeqs} />
        ))}
      </div>
    </main>
  );
}
