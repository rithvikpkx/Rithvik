import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/app/admin/auth-helper";
import { saveNotes, setFollowUp } from "@/app/admin/chats-actions";
import { getSession } from "@/lib/agent/chats-query";
import { AdminMessages } from "@/components/agent-log/Messages";
import { SessionMeta } from "@/components/agent-log/SessionViews";

export const metadata = { title: "Chat" };

/** /admin/chats/<id>: one conversation in full, with follow-up and notes controls. Admin only. */
export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const found = await getSession((await params).id);
  if (!found) notFound();
  const { session: s, messages } = found;
  return (
    <main className="alog">
      <div className="alog-wrap">
        <div className="alog-top">
          <h1>Conversation</h1>
          <Link href="/admin/chats">All chats</Link>
        </div>
        <SessionMeta s={s} />
        <div className="alog-forms">
          <form action={setFollowUp}>
            <input type="hidden" name="id" value={s.id} />
            <input type="hidden" name="on" value={s.follow_up ? "0" : "1"} />
            <button type="submit" aria-pressed={s.follow_up}>{s.follow_up ? "Following up (click to clear)" : "Flag for follow-up"}</button>
          </form>
          <form action={saveNotes}>
            <input type="hidden" name="id" value={s.id} />
            <label>
              <span className="alog-muted">Private notes</span>
              <textarea name="notes" defaultValue={s.notes ?? ""} maxLength={5000} />
            </label>
            <button type="submit" className="primary" style={{ marginTop: 8 }}>Save notes</button>
          </form>
        </div>
        <AdminMessages messages={messages} />
      </div>
    </main>
  );
}
