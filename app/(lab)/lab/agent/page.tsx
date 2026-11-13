"use client";
import SiteProvider from "@/components/site/SiteProvider";
import { fixture } from "@/lib/content/fixture";

/** /lab/agent: the agent dock on a plain page, with the fixture content and no design engine. */
export default function AgentLab() {
  return (
    <SiteProvider content={fixture}>
      <main id="top" style={{ font: "16px/1.6 system-ui", padding: 32, maxWidth: 720, margin: "0 auto", minHeight: "200vh" }}>
        <h1>Agent harness</h1>
        <p>Press Cmd+K or / to open the agent. <button data-agent="What has he built?">Ask about projects</button></p>
        <h2 id="experience">Experience</h2>
        <p>{fixture.experience.map((r) => r.role).join(" · ")}</p>
      </main>
    </SiteProvider>
  );
}
