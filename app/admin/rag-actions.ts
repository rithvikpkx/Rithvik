"use server";
import { adminClient } from "@/lib/supabase";
import {
  embedPrimary, buildProjectText, buildExperienceText,
  buildEducationText, buildSiteContentText,
} from "@/lib/embeddings";
import { revalidatePath } from "next/cache";
import { requireAuth } from "./auth-helper";

/**
 * Re-embed every primary row from scratch. Wipes primary_embeddings, then
 * walks all four content tables and inserts a fresh row per record. Use:
 *   - After applying the initial schema migration (first-run setup).
 *   - If an inline-edit's embedding silently failed and content is now stale.
 * Returns a small report so the UI can show what happened.
 */
export async function backfillPrimaryEmbeddings(): Promise<{
  projects: number; experience: number; education: number; site_content: number;
  errors: string[];
}> {
  await requireAuth();
  const db = adminClient();
  const errors: string[] = [];

  // PostgREST forbids unqualified DELETE for safety. The zero UUID never
  // collides with a real row, so .neq(...) matches everything cleanly.
  await db.from("primary_embeddings").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const counts = { projects: 0, experience: 0, education: 0, site_content: 0 };

  const { data: projects } = await db.from("projects").select("*").eq("published", true);
  for (const p of projects ?? []) {
    try {
      await embedPrimary("projects", p.id, buildProjectText(p), { slug: p.slug, title: p.title });
      counts.projects++;
    } catch (e) { errors.push(`project ${p.slug}: ${e instanceof Error ? e.message : e}`); }
  }

  const { data: experience } = await db.from("experience").select("*").eq("published", true);
  for (const e of experience ?? []) {
    try {
      await embedPrimary("experience", e.id, buildExperienceText(e), { slug: e.slug, org: e.org });
      counts.experience++;
    } catch (err) { errors.push(`experience ${e.slug}: ${err instanceof Error ? err.message : err}`); }
  }

  const { data: education } = await db.from("education").select("*").eq("published", true);
  for (const ed of education ?? []) {
    try {
      await embedPrimary("education", ed.id, buildEducationText(ed), { school: ed.school });
      counts.education++;
    } catch (err) { errors.push(`education ${ed.school}: ${err instanceof Error ? err.message : err}`); }
  }

  const { data: site } = await db.from("site_content").select("*");
  for (const row of site ?? []) {
    try {
      await embedPrimary("site_content", row.key, buildSiteContentText(row.key, row.value), { key: row.key });
      counts.site_content++;
    } catch (err) { errors.push(`site_content ${row.key}: ${err instanceof Error ? err.message : err}`); }
  }

  revalidatePath("/");
  return { ...counts, errors };
}
