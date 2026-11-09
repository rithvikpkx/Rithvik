import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import { ChatsView } from "@/components/admin/Chats";
import { parseFilters } from "@/lib/agent/chats";
import { listSessions } from "@/lib/agent/chats-query";
import { currentLook } from "@/lib/analytics/server";

export const metadata = { title: "Chats" };

/** /admin/chats: every agent conversation, newest first, with filters. Admin only. */
export default async function ChatsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const f = parseFilters(await searchParams);
  const [{ look, font, fonts, now }, rows] = await Promise.all([currentLook(), listSessions(f)]);
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="chats">
        <ChatsView rows={rows} f={f} base="/admin" now={now} />
      </AdminFrame>
    </>
  );
}
