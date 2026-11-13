/** The dashboard chrome (one theme, no look switching): the ouroboros and a mono path, the four views, the period
 *  detents (plain links: no JS), and the live clock that refreshes the page's data. Works inside any root layout. */
import Link from "next/link";
import "./admin.css";
import "@/components/site/charts/charts.css";
import type { ReactNode } from "react";
import Mark from "@/components/site/mark/Mark";
import { PERIODS } from "@/lib/analytics/shape";
import type { Period } from "@/lib/analytics/types";
import { Live } from "./live";

export type Tab = "overview" | "visitors" | "chats" | "music";
const TABS: [Tab, string, string][] = [["overview", "overview", ""], ["visitors", "visitors", "/visitors"], ["chats", "chats", "/chats"], ["music", "music", "/music"]];

export default function AdminFrame({ tab, base = "/admin", period, live = true, children }: {
  tab: Tab; base?: string; period?: Period; live?: boolean; children: ReactNode;
}) {
  return (
    <div className="dash">
      <header className="d-top">
        <div className="d-top-in">
          <a className="d-brand" href={base} aria-label="Dashboard home">
            <span className="d-brand-mark"><Mark kind="solid" blink label="" /></span>
            <span className="d-path">rithvik.ai<em>/admin</em></span>
          </a>
          <nav aria-label="Dashboard"><ul className="d-tabs">
            {TABS.map(([id, label, path]) => <li key={id}><a href={`${base}${path}`} aria-current={tab === id ? "page" : undefined}>{label}</a></li>)}
          </ul></nav>
          <div className="d-top-r">
            {period && (
              <nav className="d-seg" aria-label="Period">
                {PERIODS.map((p) => <a key={p} href={`${base}?period=${p}`} aria-current={p === period ? "true" : undefined}>{p}</a>)}
              </nav>
            )}
            {live && <Live />}
            <Link className="d-site" href="/">site ↗</Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
