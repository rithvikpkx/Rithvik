/**
 * RAG embedding core. All OpenAI calls live here, plus the chunkers and
 * primary-row → embedding-text builders. Server-only (uses service-role
 * Supabase client and OPENAI_API_KEY).
 */
import { adminClient } from "@/lib/supabase";

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;

/** Single-shot embed. Throws on non-2xx. */
export async function embedText(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  const v = json.data[0].embedding;
  if (v.length !== EMBED_DIM) throw new Error(`Unexpected embedding dim: ${v.length}`);
  return v;
}

/**
 * Greedy paragraph-aware chunker. Splits on blank lines first, then merges
 * paragraphs until adding the next one would exceed maxChars. Designed for
 * essays / PDFs — primary content rarely needs chunking and bypasses this.
 *
 * 1500 chars is well under text-embedding-3-small's 8191-token input limit
 * but gives enough overlap for paragraph-level semantic search.
 */
export function chunkText(text: string, maxChars = 1500): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buf = "";
  for (const p of paragraphs) {
    if (!buf) { buf = p; continue; }
    if (buf.length + 2 + p.length <= maxChars) {
      buf += "\n\n" + p;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf) chunks.push(buf);
  return chunks.length ? chunks : [text.slice(0, maxChars)];
}

import type { Project, Experience, Education } from "@/lib/types";

/** Builds the embed text for a project row. Order matters: most distinctive
 *  fields first so similarity ranks them strongly. */
export function buildProjectText(p: Project): string {
  const lines = [
    `Project: ${p.title}`,
    p.badge && `Type: ${p.badge}`,
    `Description: ${p.description}`,
    p.tags?.length ? `Tags: ${p.tags.join(", ")}` : null,
    p.links && Object.keys(p.links).length
      ? `Links: ${Object.entries(p.links).map(([k, v]) => `${k}=${v}`).join(", ")}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildExperienceText(e: Experience): string {
  const lines = [
    `Role: ${e.role} at ${e.org}`,
    `Type: ${e.type}`,
    `Dates: ${e.date_range}`,
    e.location && `Location: ${e.location}`,
    `Description: ${e.description}`,
    e.tags?.length ? `Tags: ${e.tags.join(", ")}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildEducationText(ed: Education): string {
  const concentrations = ed.concentrations?.length
    ? ` with concentrations in ${ed.concentrations.join(", ")}`
    : "";
  return `Education: ${ed.degree} at ${ed.school}${concentrations}.`;
}

export function buildSiteContentText(key: string, value: string): string {
  // site_content stores raw string/JSON; surface the key so RAG knows the
  // context (e.g. "hero.tagline" vs "contact.headline").
  return `[${key}] ${value}`;
}

type PrimaryTable = "projects" | "experience" | "education" | "site_content";

/** Upserts a single primary_embeddings row. Idempotent on (source_table, source_id). */
export async function embedPrimary(
  source_table: PrimaryTable,
  source_id: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const embedding = await embedText(content);
  const { error } = await adminClient()
    .from("primary_embeddings")
    .upsert(
      { source_table, source_id, content, metadata, embedding, updated_at: new Date().toISOString() },
      { onConflict: "source_table,source_id" },
    );
  if (error) throw new Error(`embedPrimary upsert failed: ${error.message}`);
}

/** Removes a primary_embeddings row. Called from deleteProject etc. */
export async function deletePrimary(
  source_table: PrimaryTable,
  source_id: string,
): Promise<void> {
  const { error } = await adminClient()
    .from("primary_embeddings")
    .delete()
    .eq("source_table", source_table)
    .eq("source_id", source_id);
  if (error) throw new Error(`deletePrimary failed: ${error.message}`);
}
