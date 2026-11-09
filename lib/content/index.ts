import "server-only";
import type { Content } from "./types";
import { fixture } from "./fixture";

export type { Content, ContentProject, ContentRole, Place } from "./types";

/** Returns the site content in the v7 shape. shortcut: serves the fixture until
 *  feat/content-model wires the DB read; callers must not depend on that. */
export async function getContent(): Promise<Content> {
  return fixture;
}
