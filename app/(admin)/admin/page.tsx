import { requireAuth } from "@/app/admin/auth-helper";
import AdminFrame from "@/components/admin/AdminFrame";
import Dashboard from "@/components/admin/Dashboard";
import { currentLook, getDashboard } from "@/lib/analytics/server";
import { parsePeriod } from "@/lib/analytics/shape";
import { writeSummary } from "./actions";

export const metadata = { title: "Dashboard" };

/** /admin: the analytics and observability overview for one period (?period=24h|7d|30d|all). Admin only. */
export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAuth();
  const period = parsePeriod((await searchParams).period);
  const [{ look, font, fonts }, d] = await Promise.all([currentLook(), getDashboard(period)]);
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <AdminFrame look={look} font={font} tab="overview" period={period}>
        <Dashboard d={d} write={writeSummary.bind(null, period)} />
      </AdminFrame>
    </>
  );
}
