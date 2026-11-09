import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorsView } from "@/components/admin/People";
import { fixtureVisitors } from "@/lib/track/fixture";
import { fontVars, labLook } from "../look";

/** /lab/dashboard/visitors: the visitors list on fixture rows (local only). */
export default async function VisitorsLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { look, font, fonts } = await labLook(await searchParams);
  const rows = fixtureVisitors.filter((v) => !v.is_bot);
  return (
    <div className={fontVars}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="visitors" base="/lab/dashboard">
        <VisitorsView rows={rows} total={rows.length} f={{ q: "", country: "", type: "", identified: false, page: 0 }} base="/lab/dashboard" now={Date.UTC(2026, 10, 9, 18)} pageSize={40} />
      </AdminFrame>
    </div>
  );
}
