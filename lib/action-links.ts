/**
 * Loads the URLs the RAG bot is allowed to offer, straight from the database.
 *
 * This is the allowlist half of the action security rule: `deriveActions()`
 * only ever names a record, and the URL it produces comes from here. A URL the
 * site doesn't already publish can never end up behind a button, so a model —
 * or a prompt-injected secondary document — has no path to a clickable link.
 *
 * Server-only (service-role client).
 */
import { adminClient } from "@/lib/supabase";
import type { ActionLinkSources } from "@/lib/chat-actions";

const EMPTY: ActionLinkSources = { projectLinks: {}, experienceUrls: {}, educationUrls: {} };

/**
 * One round trip per table, all in parallel. Only published rows: an unpublished
 * project isn't on the page, so pointing at it would 404 the scroll and leak a
 * draft link.
 *
 * Never throws — actions are a nicety, and a lookup failure must not affect the
 * answer.
 */
export async function loadActionLinks(): Promise<ActionLinkSources> {
  try {
    const db = adminClient();
    const [projects, experience, education] = await Promise.allSettled([
      db.from("projects").select("slug, links").eq("published", true),
      db.from("experience").select("slug, org_url").eq("published", true),
      db.from("education").select("school, school_url").eq("published", true),
    ]);

    const out: ActionLinkSources = { projectLinks: {}, experienceUrls: {}, educationUrls: {} };

    if (projects.status === "fulfilled" && !projects.value.error) {
      for (const row of (projects.value.data ?? []) as { slug: string; links: unknown }[]) {
        if (row.slug && row.links && typeof row.links === "object") {
          out.projectLinks[row.slug] = row.links as Record<string, string>;
        }
      }
    }
    if (experience.status === "fulfilled" && !experience.value.error) {
      for (const row of (experience.value.data ?? []) as { slug: string; org_url: string | null }[]) {
        if (row.slug && row.org_url) out.experienceUrls[row.slug] = row.org_url;
      }
    }
    if (education.status === "fulfilled" && !education.value.error) {
      for (const row of (education.value.data ?? []) as { school: string; school_url: string | null }[]) {
        if (row.school && row.school_url) out.educationUrls[row.school] = row.school_url;
      }
    }
    return out;
  } catch (e) {
    console.warn("[rag] action links lookup failed:", e instanceof Error ? e.message : e);
    return EMPTY;
  }
}
