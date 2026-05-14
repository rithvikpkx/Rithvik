"use server";
import { adminClient } from "@/lib/supabase";
import {
  embedPrimary, buildProjectText, buildExperienceText,
  buildEducationText, buildSiteContentText,
  chunkText, embedText,
} from "@/lib/embeddings";
import { extractText, captionImage } from "@/lib/file-extractors";
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

export interface SecondaryDocRow {
  id: string;
  filename: string;
  mime_type: string;
  byte_size: number;
  uploaded_at: string;
  chunk_count: number;
}

/** Returns every secondary document with its chunk count for the UI list. */
export async function listSecondaryDocuments(): Promise<SecondaryDocRow[]> {
  await requireAuth();
  const db = adminClient();

  const { data: docs, error } = await db
    .from("secondary_documents")
    .select("id, filename, mime_type, byte_size, uploaded_at")
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Count chunks per doc. One extra round-trip but avoids a view.
  const ids = (docs ?? []).map((d) => d.id);
  const countMap = new Map<string, number>();
  if (ids.length) {
    const { data: chunks, error: chunksErr } = await db
      .from("secondary_embeddings")
      .select("document_id")
      .in("document_id", ids)
      .range(0, 99999);
    if (chunksErr) throw new Error(chunksErr.message);
    for (const c of chunks ?? []) {
      countMap.set(c.document_id, (countMap.get(c.document_id) ?? 0) + 1);
    }
  }
  return (docs ?? []).map((d) => ({ ...d, chunk_count: countMap.get(d.id) ?? 0 }));
}

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_CHUNKS_PER_DOC = 200;

/**
 * Accepts a single file from a <form action={uploadSecondaryDocument}>.
 * Steps:
 *  1. Validate (size, mime supported).
 *  2. Upload original bytes to the 'secondary' Storage bucket.
 *  3. Insert the secondary_documents row.
 *  4. Extract text (or caption if image), chunk it, embed each chunk.
 *  5. Insert secondary_embeddings rows.
 * If any step after the doc row insert fails, we delete the doc row (and the
 * cascade clears any embeddings already written). The Storage object is also
 * cleaned up on failure.
 */
export async function uploadSecondaryDocument(formData: FormData): Promise<SecondaryDocRow> {
  await requireAuth();
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("No file provided.");
  if (file.size === 0) throw new Error("File is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB limit.`);
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "application/octet-stream";
  const extracted = await extractText(bytes, mime);
  if (extracted.kind === "unsupported") throw new Error(extracted.reason);

  const db = adminClient();
  const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  // 1) Upload original to Storage
  const { error: upErr } = await db.storage
    .from("secondary")
    .upload(storagePath, bytes, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  // 2) Insert doc row
  const { data: doc, error: docErr } = await db
    .from("secondary_documents")
    .insert({ filename: file.name, mime_type: mime, storage_path: storagePath, byte_size: file.size })
    .select("id, filename, mime_type, byte_size, uploaded_at")
    .single();
  if (docErr) {
    await db.storage.from("secondary").remove([storagePath]);
    throw new Error(`Document insert failed: ${docErr.message}`);
  }

  // 3) Convert to embeddable text
  let chunks: string[] = [];
  try {
    if (extracted.kind === "image") {
      const caption = await captionImage(extracted.bytes, extracted.mime);
      chunks = [caption]; // captions are short — no further splitting
    } else {
      chunks = chunkText(extracted.text);
      if (chunks.length === 0) throw new Error("No extractable text found in file.");
    }

    if (chunks.length > MAX_CHUNKS_PER_DOC) {
      throw new Error(`File produces ${chunks.length} chunks (cap is ${MAX_CHUNKS_PER_DOC}). Split into smaller files.`);
    }

    // 4) Embed + insert each chunk
    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embedText(chunks[i]);
      const { error: embErr } = await db.from("secondary_embeddings").insert({
        document_id: doc.id,
        chunk_index: i,
        content: chunks[i],
        metadata: { filename: file.name, mime_type: mime },
        embedding,
      });
      if (embErr) throw new Error(`Embedding insert failed: ${embErr.message}`);
    }
  } catch (e) {
    // Roll back the doc row (cascade deletes any partial embeddings) + storage
    await db.from("secondary_documents").delete().eq("id", doc.id);
    await db.storage.from("secondary").remove([storagePath]);
    throw e;
  }

  revalidatePath("/");
  return {
    id: doc.id,
    filename: doc.filename,
    mime_type: doc.mime_type,
    byte_size: doc.byte_size,
    uploaded_at: doc.uploaded_at,
    chunk_count: chunks.length,
  };
}

/** Removes the document, all its embeddings (via FK cascade), and the
 *  underlying Storage object. */
export async function deleteSecondaryDocument(id: string): Promise<void> {
  await requireAuth();
  const db = adminClient();
  const { data: doc, error: getErr } = await db
    .from("secondary_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (getErr) throw new Error(getErr.message);

  const { error: delErr } = await db.from("secondary_documents").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);

  // Best-effort storage delete — if it fails we've already lost the DB row;
  // the orphaned object is harmless.
  await db.storage.from("secondary").remove([doc.storage_path]);
  revalidatePath("/");
}
