import "@/components/agent-log/log.css";
import { ChatList, VisitCard, VisitorFilterForm, VisitorMeta, VisitorTable } from "@/components/visitor-log/VisitorViews";
import { fixtureChats, fixtureEvents, fixtureReplay, fixtureVisit, fixtureVisitor, fixtureVisitors } from "@/lib/track/fixture";

/** /lab/visitors: the admin visitor list, a visitor timeline and the replay player on fixture data (the real pages need a login and the tables). */
export default function VisitorsLab() {
  return (
    <main className="alog">
      <div className="alog-wrap">
        <h1>Lab: admin visitors (fixtures)</h1>
        <VisitorFilterForm f={{ identified: false, bots: true, company: "", country: "", from: "2026-11-01", to: null }} />
        <VisitorTable rows={fixtureVisitors} base="/lab/visitors" />
        <h2>Visitor view</h2>
        <VisitorMeta v={fixtureVisitor} />
        <h2>Agent conversations</h2>
        <ChatList chats={fixtureChats} base="/lab/chats" />
        <h2>Visits</h2>
        <VisitCard visit={fixtureVisit} events={fixtureEvents} replaySeqs={[0]} replayEvents={fixtureReplay} />
      </div>
    </main>
  );
}
