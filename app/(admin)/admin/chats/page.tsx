import Link from "next/link";
import { requireAuth } from "@/app/admin/auth-helper";
import { parseFilters } from "@/lib/agent/chats";
import { listSessions } from "@/lib/agent/chats-query";
import { FilterForm, SessionTable } from "@/components/agent-log/SessionViews";

export const metadata = { title: "Chats" };

/** /admin/chats: every agent conversation, newest first, with filters. Admin only. */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const filters = parseFilters(await searchParams);
  const rows = await listSessions(filters);
  return (
    <main className="alog">
      <div className="alog-wrap">
        <div className="alog-top">
          <h1>Chats</h1>
          <Link href="/">Back to site</Link>
        </div>
        <FilterForm f={filters} />
        <SessionTable rows={rows} />
      </div>
    </main>
  );
}
