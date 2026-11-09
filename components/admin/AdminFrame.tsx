/** The admin chrome: the look's tokens on a wrapper (so it works inside any root layout, including the lab), a sticky
 *  header with tabs, the period switch (plain links: no JS) and, on the overview, the section jump bar. */
import Link from "next/link";
import "./admin.css";
import "@/components/site/charts/charts.css";
import type { ReactNode } from "react";
import { lookCss, type Look } from "@/lib/analytics/look";
import { PERIODS, PERIOD_LABEL } from "@/lib/analytics/shape";
import type { Period } from "@/lib/analytics/types";

export type Tab = "overview" | "visitors" | "chats";
const TABS: [Tab, string, string][] = [["overview", "Overview", ""], ["visitors", "Visitors", "/visitors"], ["chats", "Chats", "/chats"]];
const JUMP: [string, string][] = [["summary", "Summary"], ["traffic", "Traffic"], ["audience", "Audience"], ["engagement", "Engagement"], ["agent", "Agent"], ["outreach", "Outreach"], ["system", "System"]];

export default function AdminFrame({ look, font, tab, base = "/admin", period, children }: {
  look: Look; font?: string; tab: Tab; base?: string; period?: Period; children: ReactNode;
}) {
  const q = (p: Period) => `${base}?period=${p}`;
  return (
    <div className="adm" data-look={look.id} style={{ colorScheme: look.dark ? "dark" : "light", ...(font ? { ["--adm-font" as string]: font } : {}) }}>
      <style dangerouslySetInnerHTML={{ __html: lookCss(look, `.adm[data-look="${look.id.replace(/[^a-z0-9-]/gi, "")}"]`) }} />
      <header className="adm-top">
        <div className="adm-top-in">
          <a className="adm-brand" href={base}><span className="adm-logo" aria-hidden="true">R</span>Admin<small title="The look you last chose on the site">{look.name}</small></a>
          <nav aria-label="Admin"><ul className="adm-tabs">
            {TABS.map(([id, label, path]) => <li key={id}><a href={`${base}${path}`} aria-current={tab === id ? "page" : undefined}>{label}</a></li>)}
          </ul></nav>
          <div className="adm-top-r">
            {period && (
              <nav className="adm-seg" aria-label="Period">
                {PERIODS.map((p) => <a key={p} href={q(p)} aria-current={p === period ? "true" : undefined}>{p === "all" ? "All" : p}</a>)}
              </nav>
            )}
            <Link className="adm-site" href="/">Site ↗</Link>
          </div>
        </div>
        {period && (
          <nav className="adm-jump" aria-label={`Sections, ${PERIOD_LABEL[period]}`}>
            {JUMP.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
