"use client";
// Lucid: liquid glass over moving light. A skin on the shared layout (designs/PORTING.md).
// The shader is a fixed field of soft colour and caustics with thick glass drops floating over the hero (they merge
// with the drop the pointer carries). The page's chrome is glass on top of it: on Chromium the header, the dock, the
// portrait's nodes, the contact cloud and the Work hub bend what is behind them through per-size SVG lens filters
// (backdrop-filter: url()), with colour dispersion; tiles and cards bend only under the pointer. Elsewhere the same
// glass is frosted. One pointer light slides across every rim in view. html.lite: a still frame, static glass.
import { useRef, useState, type ReactNode } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { META } from "./meta";
import { useLucidMotion } from "./motion";
import { XP } from "./experience";
import LucidName from "./name-fx";
import LucidPortrait from "./portrait-fx";
import "./lucid.css";

/** Contact frame: the shared copy and cloud on one slab of thick glass. */
function ContactFrame({ children }: { children: ReactNode }) {
  return <div className="lg-mail">{children}</div>;
}

export const SKIN: Skin = {
  id: "lucid",
  ...XP,
  rootClass: "lg",
  labels: { work: "Pieces" },
  sectionClass: (id) => `ly-sec ly-wrap lg-sec lg-${id}`,
  NameFx: LucidName,
  PortraitFx: LucidPortrait,
  ContactFrame,
  contactLead: "The clearest line is email",
  projectArt: { palette: ["#0B0D24", "#EAF0FF", "#8FE6FF", "#FF7A59"], params: { hole: 0.36, lift: 14 } },
};

/** The whole Lucid site: the shared layout over the fixed light field, plus the defs the glass is cut from. */
export default function Lucid({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useLucidMotion(root);
  const [uniforms] = useState(() => ({ u_sy: 0 }));
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root}>
      <svg className="lg-defs" width="0" height="0" aria-hidden="true" focusable="false">
        {/* the contact membrane: blurred, thresholded into one liquid body, then a faint fill and a lit rim */}
        <filter id="lg-goo-f" x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="13" result="b" />
          <feColorMatrix in="b" values="0 0 0 0 .86  0 0 0 0 .94  0 0 0 0 1  0 0 0 22 -9" result="g" />
          <feMorphology in="g" operator="erode" radius="1.6" result="e" />
          <feComposite in="g" in2="e" operator="out" result="rim" />
          <feComponentTransfer in="rim" result="rimA"><feFuncA type="linear" slope=".42" /></feComponentTransfer>
          <feComponentTransfer in="g" result="body"><feFuncA type="linear" slope=".07" /></feComponentTransfer>
          <feMerge><feMergeNode in="body" /><feMergeNode in="rimA" /></feMerge>
        </filter>
      </svg>
      {/* lens filters are cut into this one at runtime (motion.ts), one per element size */}
      <svg className="lg-defs" id="lg-lenses" width="0" height="0" aria-hidden="true" focusable="false" />
      <ShaderCanvas spec={META.shader} dark uniforms={uniforms} />
    </SiteLayout>
  );
}
