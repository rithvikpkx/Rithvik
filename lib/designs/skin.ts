import type { ComponentType } from "react";
import type { Content } from "@/lib/content/types";

/** The page's sections after the hero, in render order. Each id is also the anchor the agent scrolls to. */
export const SECTIONS = ["work", "experience", "about", "play", "questions", "contact"] as const;
export type SectionId = (typeof SECTIONS)[number];

/** One-word default titles (also the header nav labels). */
export const SECTION_LABELS: Record<SectionId, string> = {
  work: "Work", experience: "Experience", about: "About", play: "Play", questions: "Questions", contact: "Contact",
};

/** The sections linked from the header nav (Questions sits next to Contact, so it stays off the bar). */
export const NAV_SECTIONS: SectionId[] = ["work", "experience", "about", "play", "contact"];

/** Props every section body gets. `skin` lets a shared body pick up the per-item slots. */
export type SectionProps = { content: Content; skin: Skin };

/** A design's theme on top of the shared layout (components/site/layout). Every field is optional; a missing
 *  one falls back to the shared default, so a new design can start as `{ id }` plus CSS. */
export type Skin = {
  id: string;
  /** Class on the page root; the design's CSS hangs off it (e.g. "th"). */
  rootClass?: string;
  /** One-word themed titles; used by the section heading and the header nav. */
  labels?: Partial<Record<SectionId, string>>;
  /** Extra classes on each `<section>` (e.g. the design's old section class, so its CSS keeps applying). */
  sectionClass?: (id: SectionId) => string;
  /** Extra class on every section `<h2>`. */
  titleClass?: string;
  /** A themed section heading (numerals, folios...). It must render the `<h2 id={hid}>` the section is labelled by. */
  Title?: ComponentType<{ id: SectionId; index: number; label: string; hid: string }>;
  /** Section body overrides. Missing = the shared default body (components/site/layout/sections.tsx). */
  sections?: Partial<Record<SectionId, ComponentType<SectionProps>>>;
  /** Drawn at the top of every section, before the title (dividers, rulers). */
  SectionOrnament?: ComponentType<{ id: SectionId; index: number }>;
  /** The hero name. Must keep `data-edit="name.first"` / `"name.last"` on the two parts. (S9) */
  NameFx?: ComponentType<{ first: string; last: string }>;
  /** Rendered inside the portrait photo; `on` flips with each click on the photo. The photo itself is never
   *  filtered while `on` is false. (S9) */
  PortraitFx?: ComponentType<{ on: boolean }>;
  /** Drawn between consecutive roles by the shared Experience body (index = the role above). (S8) */
  ExperienceConnector?: ComponentType<{ index: number; count: number }>;
  /** Replaces the shared education row with a themed object. Keep the `edu:*` data-edit keys. (S8) */
  EducationObject?: ComponentType<{ education: Content["education"] }>;
  /** Inputs for procedural project art: four colours plus free numeric knobs. Default: the registry swatch. (S6) */
  projectArt?: { palette: [string, string, string, string]; params?: Record<string, number> };
};
