"use client";
import SiteProvider, { useSite } from "@/components/site/SiteProvider";
import { fixture } from "@/lib/content/fixture";

const QUESTIONS = ["What has he built with computer vision?", "Is he open to relocating?", "Which project is he proudest of?"];

/** A fake Questions card: clicking it hands its question and its rect to the agent, as the real section will. */
function Card({ q, style }: { q: string; style: React.CSSProperties }) {
  const { openAgent } = useSite();
  return (
    <button type="button" data-testid="card" style={{ position: "absolute", width: 260, padding: "18px 20px", textAlign: "left", font: "500 16px/1.4 system-ui", border: "1px solid #bbb", borderRadius: 14, background: "#fff", cursor: "pointer", ...style }}
      onClick={(e) => openAgent(q, { originRect: e.currentTarget.getBoundingClientRect() })}>
      {q}
    </button>
  );
}

/** /lab/agent-handoff: the openAgent(question, { originRect }) fly-in on a plain page, with fake cards. */
export default function AgentHandoffLab() {
  return (
    <SiteProvider content={fixture}>
      <main style={{ position: "relative", minHeight: "100vh", background: "#f4f4f2", font: "16px/1.6 system-ui" }}>
        <p style={{ margin: 0, padding: 24 }}>Click a card: its question flies into the agent prompt, then runs.</p>
        <Card q={QUESTIONS[0]} style={{ left: 24, top: 90 }} />
        <Card q={QUESTIONS[1]} style={{ right: 24, top: 200 }} />
        <Card q={QUESTIONS[2]} style={{ left: "30%", top: 330 }} />
      </main>
    </SiteProvider>
  );
}
