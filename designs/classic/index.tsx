"use client";
import type { DesignProps } from "@/lib/designs/types";
import type { Skin } from "@/lib/designs/skin";
import SiteLayout from "@/components/site/layout/SiteLayout";
import ClassicName from "./name-fx";
import ClassicPortrait from "./portrait-fx";
import "./classic.css";


/** Classic is the reference skin: shared defaults coloured by the palette's tokens, plus the kinetic name and a
 *  duotone portrait. */
const SKIN: Skin = { id: "classic", rootClass: "cl", NameFx: ClassicName, PortraitFx: ClassicPortrait };

/** Classic: the calm long page every legacy palette renders with. */
export default function Classic({ content }: DesignProps) {
  return <SiteLayout content={content} skin={SKIN} />;
}
