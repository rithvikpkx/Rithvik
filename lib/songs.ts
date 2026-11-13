import "server-only";
import { unstable_cache } from "next/cache";
import { adminClient } from "@/lib/supabase-server";

export const SONGS_TAG = "songs";
export const SONG_PATH = /^[0-9a-f-]{36}\.mp3$/; // storage names are server-made uuids, never the uploaded file's name
export type Song = { id: string; title: string; artist: string | null; url: string };

/** The record crate in play order, with each file's public URL. Cached 60s; admin actions refresh it at once. */
export const getSongs = unstable_cache(async (): Promise<Song[]> => {
  const db = adminClient();
  const { data, error } = await db.from("songs").select("id,title,artist,path").order("sort").order("created_at");
  if (error) { console.error("[songs] read failed:", error.message); return []; }
  return (data ?? []).map((s) => ({ id: s.id, title: s.title, artist: s.artist, url: db.storage.from("music").getPublicUrl(s.path).data.publicUrl }));
}, ["songs"], { revalidate: 60, tags: [SONGS_TAG] });
