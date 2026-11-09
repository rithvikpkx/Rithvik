import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorsView } from "@/components/admin/People";
import { currentLook, listVisitorsPage, PAGE_SIZE } from "@/lib/analytics/server";

export const metadata = { title: "Visitors" };

/** /admin/visitors: every tracked browser (bots hidden), searchable and paginated. Admin only. */
export default async function VisitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const f = {
    q: one("q").trim().slice(0, 80), country: one("country").trim().toUpperCase().slice(0, 2), type: one("type"),
    identified: one("identified") === "1", page: Math.min(500, Math.max(0, Number.parseInt(one("page"), 10) || 0)),
  };
  const [{ look, font, fonts, now }, { rows, total }] = await Promise.all([currentLook(), listVisitorsPage(f)]);
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="visitors">
        <VisitorsView rows={rows} total={total} f={f} base="/admin" now={now} pageSize={PAGE_SIZE} />
      </AdminFrame>
    </>
  );
}
