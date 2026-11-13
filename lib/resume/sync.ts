import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase-server";
import { chunkText, embedTexts } from "@/lib/embeddings";
import { pdfProblem, redactResume, staleVersions, MAX_PDF_BYTES } from "./pure";

export const RESUME_BUCKET = "resume";
const FETCH_TIMEOUT_MS = 15_000;
// Fixed ids so every sync overwrites the same agent document instead of piling up new ones.
const AGENT_DOC_ID = "5e5a0b1e-0000-4000-8000-000000000001";
const AGENT_DOC_PATH = "resume/resume.txt";

export type ResumeVersion = {
  id: string; created_at: string; source: "gdoc" | "upload"; sha256: string;
  storage_path: string; bytes: number; text: string; pinned: boolean; is_current: boolean;
};
export type SyncResult = { status: "updated" | "unchanged" | "skipped"; reason?: string; embedError?: string };

type Db = ReturnType<typeof adminClient>;

/** Unwraps a Supabase result or throws with context (the client returns errors instead of throwing). */
function must<T>(r: { data: T; error: { message: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
}

/** The current resume version, or null when none exists (or the migration has not been applied yet). */
export async function currentVersion(db: Db = adminClient()): Promise<ResumeVersion | null> {
  const { data, error } = await db.from("resume_versions").select("*").eq("is_current", true).limit(1);
  if (error) { console.warn("[resume] current version unavailable:", error.message); return null; }
  return (data?.[0] as ResumeVersion | undefined) ?? null;
}

/** Downloads one export of the master Google Doc (public link) with a hard timeout. */
async function pull(format: "pdf" | "txt") {
  const id = process.env.RESUME_DOC_ID || "1mxarfdKpYkUzv-id65KVlA0T9KKEVQM2czRApiGlQOg";
  const res = await fetch(`https://docs.google.com/document/d/${id}/export?format=${format}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: "no-store",
  });
  if (!res.ok) throw new Error(`Google Docs ${format} export failed (${res.status})`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") };
}

/** Pulls the Google Doc and stores it if it changed. A pinned (uploaded) resume is left alone unless
 *  `force`. Throws if the export is unreachable or fails validation, so a bad fetch never replaces a good PDF. */
export async function syncResume({ force = false } = {}): Promise<SyncResult> {
  const current = await currentVersion();
  if (current?.pinned && !force) return { status: "skipped", reason: "an uploaded resume is pinned" };

  const [pdf, txt] = await Promise.all([pull("pdf"), pull("txt")]);
  const bad = pdfProblem(pdf.bytes, pdf.type);
  if (bad) throw new Error(`Google Doc PDF rejected: ${bad}`);
  // A private doc answers 200 with an HTML sign-in page, so the type is checked, not just the status.
  if (!txt.type?.startsWith("text/plain") || txt.bytes.length > MAX_PDF_BYTES) throw new Error("Google Doc text export rejected");
  return storeResume({ pdf: Buffer.from(pdf.bytes), text: new TextDecoder().decode(txt.bytes), source: "gdoc", pinned: false });
}

/** Stores a validated PDF as the new current version: upload first, insert, then flip is_current in one
 *  atomic statement, so a failure at any step leaves the previous version serving. */
export async function storeResume(
  { pdf, text, source, pinned }: { pdf: Buffer; text: string; source: "gdoc" | "upload"; pinned: boolean },
): Promise<SyncResult> {
  const db = adminClient();
  const current = await currentVersion(db);
  const sha256 = createHash("sha256").update(pdf).digest("hex");

  if (current?.sha256 === sha256) {
    // Same bytes: only the pin can differ (re-uploading the synced PDF, or un-pinning an identical upload).
    if (current.pinned !== pinned) must(await db.from("resume_versions").update({ pinned }).eq("id", current.id), "unpin");
    // Heal an earlier embed failure without paying for an embed on every unchanged daily run.
    const missing = !(must(await db.from("secondary_documents").select("id").eq("id", AGENT_DOC_ID), "agent doc lookup")?.length);
    return { status: "unchanged", embedError: missing ? await embedResume(current.text) : undefined };
  }

  const clean = redactResume(text);
  const id = randomUUID();
  const storage_path = `${id}.pdf`;
  must(await db.storage.from(RESUME_BUCKET).upload(storage_path, pdf, { contentType: "application/pdf" }), "storage upload");
  try {
    must(await db.from("resume_versions").insert({ id, source, sha256, storage_path, bytes: pdf.length, text: clean, pinned }), "insert version");
  } catch (e) {
    await db.storage.from(RESUME_BUCKET).remove([storage_path]); // no row will ever reference it
    throw e;
  }
  must(await db.rpc("resume_set_current", { p_id: id }), "set current");

  // Housekeeping and agent embedding run after the swap: their failure must not undo a good sync.
  await prune(db).catch((e) => console.warn("[resume] prune failed:", e));
  return { status: "updated", embedError: await embedResume(clean) };
}

/** Deletes versions (rows + PDFs) beyond the newest 10, keeping the current one. */
async function prune(db: Db) {
  const stale = staleVersions(must(await db.from("resume_versions").select("id, created_at, is_current, storage_path"), "list versions") as
    { id: string; created_at: string; is_current: boolean; storage_path: string }[]);
  if (!stale.length) return;
  await db.storage.from(RESUME_BUCKET).remove(stale.map((s) => s.storage_path));
  must(await db.from("resume_versions").delete().in("id", stale.map((s) => s.id)), "delete versions");
}

/** Makes the redacted resume text retrievable by the agent as ONE secondary document with a fixed id
 *  (primary rows are one-per-record and get trimmed by the backfill). Embeds first, upserts over the old
 *  chunks, then trims the tail, so there is never a moment without embeddings. Returns an error message
 *  instead of throwing. */
async function embedResume(text: string): Promise<string | undefined> {
  try {
    const db = adminClient();
    const chunks = chunkText(text).map((c) => `Rithvik Praveen Kumar's resume: ${c}`);
    if (!chunks.length) return "resume text is empty";
    const vectors = await embedTexts(chunks);
    const body = Buffer.from(text);
    // Stored in the 'secondary' bucket as plain text so "Re-embed all secondary documents" works on it unchanged.
    must(await db.storage.from("secondary").upload(AGENT_DOC_PATH, body, { contentType: "text/plain", upsert: true }), "agent doc upload");
    must(await db.from("secondary_documents").upsert(
      { id: AGENT_DOC_ID, filename: "Resume (synced from Google Docs).txt", mime_type: "text/plain", storage_path: AGENT_DOC_PATH, byte_size: body.length },
      { onConflict: "id" }), "agent doc row");
    must(await db.from("secondary_embeddings").upsert(
      chunks.map((content, i) => ({ document_id: AGENT_DOC_ID, chunk_index: i, content, metadata: { filename: "resume", mime_type: "text/plain" }, embedding: vectors[i] })),
      { onConflict: "document_id,chunk_index" }), "agent embeddings");
    must(await db.from("secondary_embeddings").delete().eq("document_id", AGENT_DOC_ID).gte("chunk_index", chunks.length), "trim embeddings");
  } catch (e) {
    console.warn("[resume] agent embed failed:", e);
    return e instanceof Error ? e.message : String(e);
  }
}
