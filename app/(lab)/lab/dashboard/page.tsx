import AdminFrame from "@/components/admin/AdminFrame";
import Dashboard from "@/components/admin/Dashboard";
import { dashboardFixture, SAMPLE_SUMMARY } from "@/lib/analytics/fixture";
import { parsePeriod } from "@/lib/analytics/shape";
import { fontVars, labGuard } from "./look";

/** /lab/dashboard?period=<p>: the admin overview on fixture data (local only). */
export default async function DashboardLab({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  labGuard();
  const period = parsePeriod((await searchParams).period);
  return (
    <div className={fontVars}>
      <AdminFrame tab="overview" base="/lab/dashboard" period={period} live={false}>
        <Dashboard d={dashboardFixture(period)} base="/lab/dashboard" sample={SAMPLE_SUMMARY} />
      </AdminFrame>
    </div>
  );
}
