"use client";
import { Newsreader } from "next/font/google";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ClassicName from "./name-fx";
import ClassicPortrait from "./portrait-fx";
import "./classic.css";

// Italic serif for the name only; loaded with this design's chunk. Variable weight, so the kinetic name can spring.
const serif = Newsreader({ subsets: ["latin"], style: "italic", variable: "--cl-serif", display: "swap" });

/** Classic is the reference skin: shared defaults coloured by the palette's tokens, plus the kinetic name and a
 *  duotone portrait. */
const SKIN: Skin = { id: "classic", rootClass: `cl ${serif.variable}`, NameFx: ClassicName, PortraitFx: ClassicPortrait };

/** Classic: the calm long page every legacy palette renders with. */
export default function Classic({ content }: DesignProps) {
  return <SiteLayout content={content} skin={SKIN} />;
}
