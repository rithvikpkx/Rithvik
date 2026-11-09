import Link from "next/link";
import { requireAuth } from "@/app/admin/auth-helper";
import { listVisitors } from "@/lib/track/query";
import { parseVisitorFilters } from "@/lib/track/views";
import { VisitorFilterForm, VisitorTable } from "@/components/visitor-log/VisitorViews";

export const metadata = { title: "Visitors" };

/** /admin/visitors: every tracked browser, most recently seen first, with filters. Admin only. */
export default async function VisitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const filters = parseVisitorFilters(await searchParams);
  const rows = await listVisitors(filters);
  return (
    <main className="alog">
      <div className="alog-wrap">
        <div className="alog-top">
          <h1>Visitors</h1>
          <span><Link href="/admin/chats">Chats</Link> · <Link href="/">Back to site</Link></span>
        </div>
        <VisitorFilterForm f={filters} />
        <VisitorTable rows={rows} />
      </div>
    </main>
  );
}
