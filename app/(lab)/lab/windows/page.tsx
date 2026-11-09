import SiteProvider from "@/components/site/SiteProvider";
import { fixture } from "@/lib/content/fixture";
import "./lab.css";

/** Harness for the case sheet, composer and resume windows (declarative data-* triggers). */
export default function Page() {
  return (
    <SiteProvider content={fixture}>
      <main style={{ padding: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="ui-btn" data-case="boilerframe">Open case</button>
        <button className="ui-btn" data-compose="Hello">Compose</button>
        <button className="ui-btn" data-resume>Resume</button>
        <p style={{ width: "100%", color: "var(--ui-muted)" }}>Lab: windows. Background text to test non-modal windows.</p>
      </main>
    </SiteProvider>
  );
}
