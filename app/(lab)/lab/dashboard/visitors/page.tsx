import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorsView } from "@/components/admin/People";
import { visitorActivity } from "@/lib/analytics/strips";
import { fixtureVisitors } from "@/lib/track/fixture";
import { fontVars, labGuard } from "../look";

const NOW = Date.UTC(2026, 10, 9, 18);
const extra = [
  { id: "523e4567-e89b-12d3-a456-426614174000", name: "Jordan Chen", email: "jordan@stripe.com", company_given: "Stripe", company: null, org: "Stripe, Inc.", ip_type: "business" as const, city: "Seattle", region: "WA", country: "US", device: "desktop", visits: 4, last_seen: "2026-11-07T16:00:00Z" },
  { id: "623e4567-e89b-12d3-a456-426614174000", name: null, email: null, company_given: null, company: null, org: "Reliance Jio", ip_type: "isp" as const, city: "Hyderabad", region: "TG", country: "IN", device: "mobile", visits: 1, last_seen: "2026-11-06T09:00:00Z", first_referrer: null },
  { id: "723e4567-e89b-12d3-a456-426614174000", name: null, email: null, company_given: null, company: "Google", org: "Google LLC", ip_type: "business" as const, city: "Mountain View", region: "CA", country: "US", device: "desktop", visits: 2, last_seen: "2026-11-05T19:00:00Z", first_referrer: "https://www.google.com/" },
];
const rows = [...fixtureVisitors.filter((v) => !v.is_bot), ...extra.map((x) => ({ ...fixtureVisitors[0], ...x, identified_at: x.email ? x.last_seen : null }))];
// a deterministic sprinkle of visits and key events over the last 30 days
const visits = rows.flatMap((v, i) => Array.from({ length: v.visits + i }, (_, j) => ({ id: `${v.id}-${j}`, visitor_id: v.id, started_at: new Date(NOW - ((i * 7 + j * 5) % 29) * 86_400_000).toISOString() })));
const events = visits.flatMap((x, j) => (["agent_turn", "composer_send", "resume", "overlay", "identify"] as const).filter((_, k) => (j + k) % (k + 2) === 0 && !(k === 4 && !rows.find((r) => r.id === x.visitor_id)?.email)).map((type) => ({ visit_id: x.id, type })));
const activity = visitorActivity(visits, events, NOW);

/** /lab/dashboard/visitors: the visitors list on fixture rows (local only). */
export default function VisitorsLab() {
  labGuard();
  return (
    <div className={fontVars}>
      <AdminFrame tab="visitors" base="/lab/dashboard" live={false}>
        <VisitorsView rows={rows} total={rows.length} f={{ q: "", country: "", type: "", identified: false, page: 0 }} base="/lab/dashboard" now={NOW} pageSize={40} activity={activity} />
      </AdminFrame>
    </div>
  );
}
