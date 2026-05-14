"use server";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  embedPrimary, deletePrimary,
  buildProjectText, buildExperienceText, buildEducationText, buildSiteContentText,
} from "@/lib/embeddings";
import { requireAuth } from "./auth-helper";

/**
 * Wraps an embedding call so it never throws into the caller. The DB write
 * has already succeeded by the time we call this; if embedding fails we log
 * and continue — the user's content is safe, RAG just won't see the latest
 * version of this row until backfillPrimaryEmbeddings runs.
 */
async function safeEmbed(label: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); }
  catch (e) { console.error(`[rag] ${label} embed failed:`, e instanceof Error ? e.message : e); }
}

function revalidate() {
  revalidatePath("/");
}

export interface ProjectInput {
  slug: string;
  title: string;
  badge: string;
  description: string;
  tags: string[];
  links: Record<string, string>;
  image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

export async function createProject(data: ProjectInput) {
  await requireAuth();
  const { data: created, error } = await adminClient()
    .from("projects")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${created.id}`, () =>
    embedPrimary("projects", created.id, buildProjectText(created),
                 { slug: created.slug, title: created.title }));
  return created;
}

export async function updateProject(id: string, data: ProjectInput) {
  await requireAuth();
  const { data: updated, error } = await adminClient()
    .from("projects").update(data).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${id}`, () =>
    embedPrimary("projects", id, buildProjectText(updated),
                 { slug: updated.slug, title: updated.title }));
}

export async function deleteProject(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`project ${id} delete`, () => deletePrimary("projects", id));
}

export interface ExperienceInput {
  slug: string;
  org: string;
  org_url: string | null;
  role: string;
  type: string;
  date_range: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  tags: string[];
  location: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

export async function createExperience(data: ExperienceInput) {
  await requireAuth();
  const { data: created, error } = await adminClient()
    .from("experience")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`experience ${created.id}`, () =>
    embedPrimary("experience", created.id, buildExperienceText(created),
                 { slug: created.slug, org: created.org }));
  return created;
}

export async function updateExperience(id: string, data: ExperienceInput) {
  await requireAuth();
  const { data: updated, error } = await adminClient()
    .from("experience").update(data).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`experience ${id}`, () =>
    embedPrimary("experience", id, buildExperienceText(updated),
                 { slug: updated.slug, org: updated.org }));
}

export async function deleteExperience(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("experience").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`experience ${id} delete`, () => deletePrimary("experience", id));
}

/** Upsert a single key/value pair into the site_content table. */
export async function upsertSiteContent(key: string, value: string) {
  await requireAuth();
  const { error } = await adminClient()
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`site_content ${key}`, () =>
    embedPrimary("site_content", key, buildSiteContentText(key, value), { key }));
}

export interface EducationInput {
  school: string;
  school_url: string | null;
  degree: string;
  concentrations: string[];
  logo_path: string | null;
  sort_order: number;
  published: boolean;
}

export async function createEducation(data: EducationInput) {
  await requireAuth();
  const { data: created, error } = await adminClient()
    .from("education").insert(data).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`education ${created.id}`, () =>
    embedPrimary("education", created.id, buildEducationText(created),
                 { school: created.school }));
}

export async function updateEducation(id: string, data: Partial<EducationInput>) {
  await requireAuth();
  const { data: updated, error } = await adminClient()
    .from("education").update(data).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`education ${id}`, () =>
    embedPrimary("education", id, buildEducationText(updated),
                 { school: updated.school }));
}

export async function deleteEducation(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("education").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`education ${id} delete`, () => deletePrimary("education", id));
}
