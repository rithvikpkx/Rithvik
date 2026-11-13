"use server";
import { updateTag } from "next/cache";
import { adminClient } from "@/lib/supabase-server";
import { SONG_PATH, SONGS_TAG } from "@/lib/songs";
import { isUuid } from "@/lib/agent/obs";
import { requireAuth } from "./auth-helper";

/** Issues a one-time signed upload URL for a new mp3 (the browser uploads straight to storage: Vercel caps request
 *  bodies at 4.5 MB). The object name is a fresh uuid, so nothing the visitor typed reaches the path. */
export async function songUploadUrl(): Promise<{ path: string; token: string }> {
  await requireAuth();
  const path = `${crypto.randomUUID()}.mp3`;
  const { data, error } = await adminClient().storage.from("music").createSignedUploadUrl(path);
  if (error || !data) { console.error("[songs] signed url failed:", error?.message); throw new Error("Could not start the upload."); }
  return { path, token: data.token };
}

/** Records an uploaded mp3 in the crate; the file must already be in the bucket. */
export async function addSong(input: { path: string; title: string; artist: string }) {
  await requireAuth();
  const title = input.title.trim().slice(0, 120), artist = input.artist.trim().slice(0, 120) || null;
  if (!SONG_PATH.test(input.path) || !title) throw new Error("Give the song a title.");
  const db = adminClient();
  const { data: files } = await db.storage.from("music").list("", { search: input.path });
  if (!files?.some((f) => f.name === input.path)) throw new Error("The upload did not finish.");
  const { count } = await db.from("songs").select("*", { count: "exact", head: true });
  const { error } = await db.from("songs").insert({ path: input.path, title, artist, sort: count ?? 0 });
  if (error) { console.error("[songs] insert failed:", error.message); throw new Error("Could not save the song."); }
  updateTag(SONGS_TAG);
}

/** Renames a song (title and artist). */
export async function renameSong(fd: FormData) {
  await requireAuth();
  const id = fd.get("id"), title = String(fd.get("title") ?? "").trim().slice(0, 120), artist = String(fd.get("artist") ?? "").trim().slice(0, 120) || null;
  if (!isUuid(id) || !title) return;
  const { error } = await adminClient().from("songs").update({ title, artist }).eq("id", id);
  if (error) { console.error("[songs] rename failed:", error.message); throw new Error("Could not save."); }
  updateTag(SONGS_TAG);
}

/** Deletes a song: the row first (so the deck stops offering it), then its file. */
export async function deleteSong(fd: FormData) {
  await requireAuth();
  const id = fd.get("id");
  if (!isUuid(id)) return;
  const db = adminClient();
  const { data, error } = await db.from("songs").delete().eq("id", id).select("path").maybeSingle();
  if (error) { console.error("[songs] delete failed:", error.message); throw new Error("Could not delete."); }
  if (data?.path) await db.storage.from("music").remove([data.path]);
  updateTag(SONGS_TAG);
}
