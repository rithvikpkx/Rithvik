"use client";
// The elemental family's shared frame (Ember, Tide, Stone, Volt, Grove): the shared layout over one fixed elemental
// world (the shader, shown around the hero and Contact), the family motion hook, and the section sigil. Each look
// passes its own meta, skin and pieces; this file holds only what they have in common.
import { useRef, type ReactNode } from "react";
import type { Content } from "@/lib/content/types";
import type { DesignMeta } from "@/lib/designs/types";
import type { SectionId, Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { IDLE_AGE } from "./core";
import { useElementalMotion } from "./motion";
import "./elemental.css";

// the shader's starting state: no strike in flight, no charge (GL would default the age to 0: a ring at birth)
const U0 = { u_burst: [0.5, 0.5, IDLE_AGE] as [number, number, number], u_charge: 0 };

/** A look's section ornament: its element's sigil, which draws itself in, and a slash of energy cut after it. */
export function sigil(glyph: ReactNode) {
  return function Sigil({ id }: { id: SectionId; index: number }) {
    return (
      <div className="el-orn" data-sec={id} aria-hidden="true">
        <svg className="el-sig" viewBox="0 0 48 48" focusable="false">
          <circle className="el-sig-ring" cx="24" cy="24" r="21" pathLength="1" />
          <g className="el-sig-g">{glyph}</g>
        </svg>
        <i className="el-slash" />
      </div>
    );
  };
}

type Props = { content: Content; skin: Skin; meta: DesignMeta; hero?: ReactNode; children?: ReactNode };

/** The whole elemental page: the shared layout, the look's hero layer, and the one fixed world behind it. */
export default function ElementalSite({ content, skin, meta, hero, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const host = meta.shader!.host!;
  useElementalMotion(root, host);
  return (
    <SiteLayout content={content} skin={skin} rootRef={root} hero={hero}>
      <div className="el-gl" id={host.slice(1)} aria-hidden="true" />
      {children}
      <ShaderCanvas spec={meta.shader} dark={meta.dark} uniforms={U0} />
    </SiteLayout>
  );
}
