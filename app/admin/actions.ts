"use server";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase";
import {
  embedPrimary, deletePrimary,
  buildProjectText, buildExperienceText, buildEducationText, buildSiteContentText,
} from "@/lib/embeddings";
import { requireAuth } from "./auth-helper";
import type { GlobeMarker, GlobeMarkerKind } from "@/lib/types";

type PublishableRow = { id: string; published: boolean };

/** Embed-or-delete per the row's published flag. Mirrors the published=true
 *  filter that backfillPrimaryEmbeddings applies, so a single row never
 *  ends up RAG-visible from one path and hidden from the other. */
async function syncPrimary(
  source_table: "projects" | "experience" | "education",
  row: PublishableRow,
  buildContent: () => string,
  metadata: Record<string, unknown>,
): Promise<void> {
  if (row.published) {
    await embedPrimary(source_table, row.id, buildContent(), metadata);
  } else {
    await deletePrimary(source_table, row.id);
  }
}

/**
 * Wraps an embedding call so it never throws into the caller. The DB write
 * has already succeeded by the time we call this; if embedding fails we log
 * and continue — the user's content is safe, RAG just won't see the latest
 * version of this row until backfillPrimaryEmbeddings runs.
 */
async function safeEmbed(label: string, fn: () => Promise<void>): Promise<void> {
  try { await fn(); }
  catch (e) {
    // The row is persisted; embedding is best-effort. Warn (don't error)
    // so OpenAI 429s and similar transient failures don't flood Vercel's
    // error stream with non-actionable noise. Recovery: run
    // backfillPrimaryEmbeddings from the SecondaryContextPanel UI.
    console.warn(`[rag] ${label} embed skipped:`, e instanceof Error ? e.message : e);
  }
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
    syncPrimary("projects", created, () => buildProjectText(created),
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
    syncPrimary("projects", updated, () => buildProjectText(updated),
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
    syncPrimary("experience", created, () => buildExperienceText(created),
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
    syncPrimary("experience", updated, () => buildExperienceText(updated),
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
    syncPrimary("education", created, () => buildEducationText(created),
                { school: created.school }));
}

export async function updateEducation(id: string, data: Partial<EducationInput>) {
  await requireAuth();
  const { data: updated, error } = await adminClient()
    .from("education").update(data).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`education ${id}`, () =>
    syncPrimary("education", updated, () => buildEducationText(updated),
                { school: updated.school }));
}

export async function deleteEducation(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("education").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
  await safeEmbed(`education ${id} delete`, () => deletePrimary("education", id));
}

const VALID_KINDS: ReadonlySet<GlobeMarkerKind> = new Set(["home", "current", "default"]);

/** Replace the full markers list. Validates each marker (lat/lng range, IANA
 *  timezone, kind enum) then upserts as a JSON array under site_content key
 *  bento.globe_markers. The existing safeEmbed + embedPrimary chain runs the
 *  globe-aware prose builder (see lib/embeddings.ts) so RAG stays in sync. */
export async function updateGlobeMarkers(markers: GlobeMarker[]): Promise<void> {
  await requireAuth();

  for (const m of markers) {
    if (!m.id || typeof m.id !== "string") throw new Error("marker id missing");
    if (!m.city?.trim()) throw new Error(`marker ${m.id}: city required`);
    if (!m.country?.trim()) throw new Error(`marker ${m.id}: country required`);
    if (typeof m.lat !== "number" || m.lat < -90 || m.lat > 90) {
      throw new Error(`marker ${m.id}: lat must be a number in [-90, 90]`);
    }
    if (typeof m.lng !== "number" || m.lng < -180 || m.lng > 180) {
      throw new Error(`marker ${m.id}: lng must be a number in [-180, 180]`);
    }
    if (!VALID_KINDS.has(m.kind)) {
      throw new Error(`marker ${m.id}: invalid kind ${m.kind}`);
    }
    try {
      // Throws RangeError for invalid IANA names. Constructing is free.
      new Intl.DateTimeFormat("en-US", { timeZone: m.timezone });
    } catch {
      throw new Error(`marker ${m.id}: invalid IANA timezone ${m.timezone}`);
    }
  }

  // Reuse the existing upsertSiteContent path — it handles the DB write,
  // revalidate, and (post-Task 5) the globe-aware embed in one shot.
  await upsertSiteContent("bento.globe_markers", JSON.stringify(markers));
}
