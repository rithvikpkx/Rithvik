"use client";
import { Newsreader } from "next/font/google";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import "./classic.css";

// Italic serif for the name only; loaded with this design's chunk.
const serif = Newsreader({ subsets: ["latin"], style: "italic", weight: "400", variable: "--cl-serif", display: "swap" });

/** Classic is the reference skin: every slot left at its shared default, coloured by the palette's tokens. */
const SKIN: Skin = { id: "classic", rootClass: `cl ${serif.variable}` };

/** Classic: the calm long page every legacy palette renders with. */
export default function Classic({ content }: DesignProps) {
  return <SiteLayout content={content} skin={SKIN} />;
}
