import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import { ChatsView } from "@/components/admin/Chats";
import { parseFilters } from "@/lib/agent/chats";
import { listSessions } from "@/lib/agent/chats-query";
import { sessionStrips } from "@/lib/analytics/server";

export const metadata = { title: "Chats" };

/** /admin/chats: every agent conversation, newest first, with filters and each one's glyph strip. Admin only. */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const f = parseFilters(await searchParams);
  const rows = await listSessions(f);
  const strips = await sessionStrips(rows.map((r) => r.id));
  return (
    <AdminFrame tab="chats">
      <ChatsView rows={rows} f={f} base="/admin" now={Date.now()} strips={strips} />
    </AdminFrame>
  );
}
