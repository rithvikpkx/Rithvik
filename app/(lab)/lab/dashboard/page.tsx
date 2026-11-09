import AdminFrame from "@/components/admin/AdminFrame";
import Dashboard from "@/components/admin/Dashboard";
import { dashboardFixture, SAMPLE_SUMMARY } from "@/lib/analytics/fixture";
import { parsePeriod } from "@/lib/analytics/shape";
import { fontVars, labLook } from "./look";

/** /lab/dashboard?look=<id>&period=<p>: the admin overview on fixture data, in any look (local only). */
export default async function DashboardLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { look, font, fonts } = await labLook(sp);
  const period = parsePeriod(sp.period);
  return (
    <div className={fontVars}>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="overview" base="/lab/dashboard" period={period}>
        <Dashboard d={dashboardFixture(period)} base="/lab/dashboard" sample={SAMPLE_SUMMARY} />
      </AdminFrame>
    </div>
  );
}
