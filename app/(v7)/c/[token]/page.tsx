import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import "@/components/agent-log/log.css";
import { SharedMessages } from "@/components/agent-log/Messages";
import { getSharedTranscript } from "@/lib/agent/chats-query";

// Shared links are private by obscurity: keep them out of search results and caches.
export const metadata: Metadata = {
  title: "Shared conversation",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: null },
  openGraph: { title: "Shared conversation" },
};

/** /c/<token>: a read-only copy of a visitor's agent conversation. 404 for unknown or expired tokens. */
export default async function SharedChat({ params }: { params: Promise<{ token: string }> }) {
  const messages = await getSharedTranscript((await params).token);
  if (!messages) notFound();
  return (
    <main className="alog">
      <div className="alog-narrow">
        <h1>Conversation with Rithvik&rsquo;s agent</h1>
        <p className="alog-muted">A read-only copy shared by the visitor. Emails and phone numbers are removed. <Link href="/">rithvik.ai</Link></p>
        <SharedMessages messages={messages} />
      </div>
    </main>
  );
}
