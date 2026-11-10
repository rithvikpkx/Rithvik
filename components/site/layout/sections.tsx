"use client";
import type { ComponentType } from "react";
import type { SectionId, SectionProps } from "@/lib/designs/skin";
import Experience from "./Experience";
import About from "./About";
import Questions from "./Questions";
import Contact from "./Contact";
import PlayField from "@/components/site/play/PlayField";
import Work from "@/components/site/work/Work";

/** The shared default body for every section. */
export const DEFAULT_SECTIONS: Record<SectionId, ComponentType<SectionProps>> = {
  work: Work, experience: Experience, about: About, play: PlayField, questions: Questions, contact: Contact,
};
