"use client";
// Tracker: a calm light lab UI watched by a small vision model. A skin on the shared layout (designs/PORTING.md).
// The depth/segmentation shader runs only inside the hero's cam0 feed (the one loud place, behind the portrait);
// DOM bounding boxes acquire real page elements (the person, the name, headings, project rows, toys) and hand over
// to whatever the pointer hovers; optical-flow arrows only while scrolling fast; a HUD with real numbers. html.lite
// and reduced motion stop the loop; lite swaps the boxes for a few static CSS annotations (a designed still).
import { useRef } from "react";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import { designById } from "@/lib/designs/registry";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ShaderCanvas from "@/components/site/ShaderCanvas";
import { MAX_BOXES, SLICE_COLORS, useTrackerMotion } from "./motion";
import { XP } from "./experience";
import TrackerName from "./name-fx";
import TrackerPortrait from "./portrait-fx";
import "./tracker.css";

const META = designById("tracker")!;


/** A section heading; also a "text" target. */
function Title({ label, hid }: { label: string; hid: string }) {
  return <h2 className="tk-h2 ly-title" id={hid} data-tk="text" data-tk-label="heading">{label}</h2>;
}


export const SKIN: Skin = {
  id: "tracker",
  ...XP,
  rootClass: "tk",
  labels: { play: "Test set" },
  sectionClass: (id) => (id === "contact" ? "tk-sec tk-contact" : "tk-sec"),
  Title,
  NameFx: TrackerName,
  PortraitFx: TrackerPortrait,
  projectArt: { palette: ["#F2F2EE", "#0C0D0F", "#E0103F", "#7E03A8"], params: { hole: 0.3, rest: 2 } },
};

/** The whole Tracker site: the shared layout watched by a small vision model. */
export default function Tracker({ content }: DesignProps) {
  const root = useRef<HTMLDivElement>(null);
  useTrackerMotion(root);
  const hero = (
    <>
      <div className="tk-hud" aria-hidden="true">
        <span className="tk-hud-st"><i /><b data-tk-state="">tracking</b></span>
        <span className="tk-hud-x"><b data-tk-fps="">60.0</b> fps</span>
        <span className="tk-hud-x">f <b data-tk-frame="">000000</b></span>
        <span>obj <b data-tk-obj="">0</b></span>
      </div>
      <figure className="tk-feed" aria-hidden="true">
        <figcaption className="tk-feed-bar"><span><i className="tk-rec" />cam0</span><span>depth + segmentation</span><span className="tk-feed-r">subjects 1</span></figcaption>
        <div className="tk-view">
          <div className="tk-gl" id="tk-gl" />
          <span className="tk-tick tl" /><span className="tk-tick tr" /><span className="tk-tick bl" /><span className="tk-tick br" />
        </div>
        <div className="tk-feed-foot"><span>near</span><i className="tk-ramp" /><span>far</span></div>
      </figure>
    </>
  );
  return (
    <SiteLayout content={content} skin={SKIN} rootRef={root} hero={hero}>
      <ShaderCanvas spec={META.shader} dark={META.dark} />
      {/* the vision layer: a fixed pool of boxes and glitch slices, positioned by transforms only */}
      <div className="tk-ov" aria-hidden="true">
        {Array.from({ length: MAX_BOXES }, (_, i) => (
          <div className="tk-box" key={i}>
            <i className="tk-e" /><i className="tk-e" /><i className="tk-e tk-ev" /><i className="tk-e tk-ev" />
            <i className="tk-c tk-c1" /><i className="tk-c tk-c2" /><i className="tk-c tk-c3" /><i className="tk-c tk-c4" />
            <span className="tk-lbl"><b /><span /></span>
          </div>
        ))}
        {SLICE_COLORS.map((k) => <i className="tk-slice" key={k} style={{ ["--k" as string]: k }} />)}
      </div>
      <svg className="tk-flow" aria-hidden="true" focusable="false"><path /></svg>
    </SiteLayout>
  );
}
