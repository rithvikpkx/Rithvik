"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addSong, songUploadUrl } from "@/app/admin/music-actions";

/** Guesses title and artist from a file name like "Smooth Operator - Sade.mp3" (either half may be missing). */
function guess(name: string) {
  const [title = "", artist = ""] = name.replace(/\.mp3$/i, "").split(/\s+-\s+/);
  return { title: title.trim(), artist: artist.trim() };
}

/** Picks an mp3, names it, and uploads it straight to the `music` bucket through a server-signed URL, then adds it to the crate. */
export default function SongUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title.trim()) return;
    setBusy(true); setMsg("Uploading…");
    try {
      const { path, token } = await songUploadUrl();
      const { supabase } = await import("@/lib/supabase-browser");
      const { error } = await supabase.storage.from("music").uploadToSignedUrl(path, token, file, { contentType: "audio/mpeg" });
      if (error) throw new Error(error.message);
      await addSong({ path, title, artist });
      setFile(null); setTitle(""); setArtist(""); setMsg("Added.");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="d-upload" onSubmit={upload}>
      <input type="file" accept="audio/mpeg,.mp3" aria-label="MP3 file" required onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        setFile(f); setMsg("");
        if (f) { const g = guess(f.name); setTitle(g.title); setArtist(g.artist); }
      }} />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" required maxLength={120} />
      <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist" aria-label="Artist" maxLength={120} />
      <button type="submit" disabled={busy || !file}>{busy ? "uploading…" : "upload"}</button>
      <span className="d-upmsg" role="status">{msg}</span>
    </form>
  );
}
