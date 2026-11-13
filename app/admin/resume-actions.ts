"use server";
import { adminClient } from "@/lib/supabase-server";
import { extractText } from "@/lib/file-extractors";
import { pdfProblem } from "@/lib/resume/pure";
import { storeResume, syncResume, type SyncResult } from "@/lib/resume/sync";
import { requireAuth } from "./auth-helper";

// Errors come back as data: Next masks the message of anything a server action throws in production.
type Outcome = SyncResult | { status: "error"; reason: string };

/** Runs an admin resume operation after the auth check and folds failures into an Outcome. */
async function run(op: () => Promise<SyncResult>): Promise<Outcome> {
  await requireAuth();
  try { return await op(); } catch (e) { return { status: "error", reason: e instanceof Error ? e.message : String(e) }; }
}

/** "Sync now": pulls the Google Doc immediately (skipped while an upload is pinned). */
export async function syncResumeNow(): Promise<Outcome> {
  return run(() => syncResume());
}

/** Replaces the resume with an uploaded PDF and pins it, so the daily sync stops overwriting it. */
export async function uploadResume(formData: FormData): Promise<Outcome> {
  return run(async () => {
    const file = formData.get("file");
    if (!(file instanceof File)) throw new Error("No file provided");
    const pdf = Buffer.from(await file.arrayBuffer());
    // File.type is client-claimed, so only size and magic bytes are checked.
    const bad = pdfProblem(pdf);
    if (bad) throw new Error(`Upload rejected: ${bad}`);
    const extracted = await extractText(pdf, "application/pdf").catch(() => null);
    return storeResume({ pdf, text: extracted?.kind === "text" ? extracted.text : "", source: "upload", pinned: true });
  });
}

/** "Resume syncing": drops the pin and pulls the Google Doc straight away. */
export async function resumeSyncing(): Promise<Outcome> {
  return run(async () => {
    const { error } = await adminClient().from("resume_versions").update({ pinned: false }).eq("is_current", true);
    if (error) throw new Error(error.message);
    return syncResume();
  });
}
