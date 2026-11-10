import AdminFrame from "@/components/admin/AdminFrame";
import { VisitorInspector } from "@/components/admin/People";
import { fixtureMessages } from "@/lib/analytics/fixture";
import { fixtureChats, fixtureEvents, fixtureReplay, fixtureVisit, fixtureVisitor } from "@/lib/track/fixture";
import { fontVars, labGuard } from "../../look";

/** /lab/dashboard/visitors/<any>: the visitor inspector on fixtures, replay included (local only). */
export default function VisitorLab() {
  labGuard();
  const earlier = { ...fixtureVisit, id: "bbbbbbbb-e89b-12d3-a456-426614174000", started_at: "2026-11-02T09:14:00Z", ended_at: "2026-11-02T09:16:30Z", entry_url: "/", design: "classic", events: fixtureEvents.slice(0, 4).map((e) => ({ ...e, id: e.id + 100, at: e.at.replace("2026-11-09T14", "2026-11-02T09") })), replaySeqs: [] };
  return (
    <div className={fontVars}>
      <AdminFrame tab="visitors" base="/lab/dashboard" live={false}>
        <VisitorInspector v={fixtureVisitor} visits={[{ ...fixtureVisit, events: fixtureEvents, replaySeqs: [] }, earlier]} chats={fixtureChats}
          messages={new Map([[fixtureChats[0].id, fixtureMessages]])} base="/lab/dashboard" now={Date.UTC(2026, 10, 9, 18)} replay={fixtureReplay} />
      </AdminFrame>
    </div>
  );
}
