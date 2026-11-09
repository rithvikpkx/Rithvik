import "server-only";
import { unstable_cache } from "next/cache";
import { serverClient } from "@/lib/supabase-server";
import type { Content } from "./types";
import { fixture } from "./fixture";
import { toContent, type Rows } from "./map";

export type { Content, ContentProject, ContentRole, Place } from "./types";

/** Cache tag for getContent(); admin actions revalidate it so edits show at once. */
export const CONTENT_TAG = "v7-content";

/** Reads the published rows + site_content and maps them to the v7 `Content`; serves the fixture if the DB read fails.
 *  Cached 60s: v7 pages read the design cookie, so they render per request and this cache keeps Supabase off that path. */
export const getContent = unstable_cache(readContent, ["v7-content"], { revalidate: 60, tags: [CONTENT_TAG] });

async function readContent(): Promise<Content> {
  const db = serverClient();
  // select("*") so columns the migration hasn't added yet don't error; `as Rows` since v7 columns aren't in the generated types.
  const [p, e, ed, s] = await Promise.all([
    db.from("projects").select("*").eq("published", true).order("sort_order"),
    db.from("experience").select("*").eq("published", true).order("sort_order"),
    db.from("education").select("*").eq("published", true).order("sort_order"),
    db.from("site_content").select("key,value"),
  ]);
  const err = p.error ?? e.error ?? ed.error ?? s.error;
  if (err) {
    console.error("[content] read failed, serving fixture:", err.message);
    return fixture;
  }
  const site = Object.fromEntries(((s.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return toContent({ projects: p.data, experience: e.data, education: ed.data, site } as Rows);
}
