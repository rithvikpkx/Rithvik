"use client";
import type { CSSProperties } from "react";
import type { ContentProject } from "@/lib/content/types";
import type { Skin } from "@/lib/designs/skin";
import { traits } from "@/lib/art/art";
import ProjectArt from "@/components/site/work/ProjectArt";
import { artPalette } from "@/components/site/layout/SiteLayout";
import { SKIN as nimbus } from "@/designs/nimbus";
import { SKIN as stipple } from "@/designs/stipple";
import { SKIN as glyph } from "@/designs/glyph";
import { SKIN as prism } from "@/designs/prism";
import { SKIN as mercury } from "@/designs/mercury";
import { SKIN as thermal } from "@/designs/thermal";
import { SKIN as starlight } from "@/designs/starlight";
import { SKIN as tracker } from "@/designs/tracker";
import { SKIN as foil } from "@/designs/foil";

const LOOKS: Skin[] = [{ id: "classic" }, nimbus, stipple, glyph, prism, mercury, thermal, starlight, tracker, foil];
// Classic draws with the page's tokens; give it GitHub Light's here
const CLASSIC_TOKENS = { "--ly-soft": "#F6F8FA", "--ui-fg": "#1F2328", "--ui-accent": "#0969DA", "--ui-muted": "#59636E" } as CSSProperties;
const s = { font: "11px/1.4 ui-monospace, Menlo, monospace", color: "#555" } as const;

/** Every project × every look, with what the reasoning step decided for each project. */
export default function ArtSheet({ projects }: { projects: ContentProject[] }) {
  const n = projects.length;
  return (
    <main style={{ padding: 16, background: "#bbb", minHeight: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: `90px repeat(${n}, minmax(0, 1fr))`, gap: 6, alignItems: "end" }}>
        <span />
        {projects.map((p) => {
          const t = traits(p);
          const top = Object.entries(t.scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" · ");
          return <div key={p.slug} style={s}><b style={{ color: "#000" }}>{p.title}</b><br />{top || "no traits"}<br />{t.code ? "code " : ""}{t.demo ? "demo" : ""}</div>;
        })}
        {LOOKS.map((skin) => [
          <span key={skin.id} style={s}>{skin.id}</span>,
          ...projects.map((p, i) => (
            <div key={skin.id + p.slug} style={{ aspectRatio: "4 / 3", ...(skin.id === "classic" ? CLASSIC_TOKENS : {}) }}>
              <ProjectArt project={p} palette={artPalette(skin)} params={skin.projectArt?.params} rank={n > 1 ? i / (n - 1) : 0} className="lab-art" />
            </div>
          )),
        ])}
      </div>
      <style>{".lab-art{display:block;width:100%;height:100%}"}</style>
    </main>
  );
}
