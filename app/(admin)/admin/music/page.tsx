import { requireAuth } from "@/app/admin/auth-helper";
import { deleteSong, renameSong } from "@/app/admin/music-actions";
import AdminFrame from "@/components/admin/AdminFrame";
import SongUpload from "@/components/admin/SongUpload";
import Trash from "@/components/admin/Trash";
import { Empty, Panel, Section } from "@/components/admin/ui";
import { getSongs } from "@/lib/songs";

export const metadata = { title: "Music" };

/** /admin/music: the Play deck's record crate. Upload mp3s, name them, preview, delete. Admin only. */
export default async function MusicPage() {
  await requireAuth();
  const songs = await getSongs();
  return (
    <AdminFrame tab="music" live={false}>
      <main className="d-main tight">
        <Section id="music" n="01" title="Record crate" meta={`${songs.length} song${songs.length === 1 ? "" : "s"} · played in this order on the deck`}>
          <div className="d-grid">
            <Panel label="add a song">
              <SongUpload />
            </Panel>
            <Panel label="songs" i={1}>
              {songs.length ? (
                <ul className="d-songs">
                  {songs.map((s) => (
                    <li key={s.id}>
                      <form action={renameSong} className="d-song">
                        <input type="hidden" name="id" value={s.id} />
                        <input name="title" defaultValue={s.title} aria-label="Title" required maxLength={120} />
                        <input name="artist" defaultValue={s.artist ?? ""} aria-label="Artist" placeholder="Artist" maxLength={120} />
                        <button type="submit">save</button>
                        <audio controls preload="none" src={s.url} />
                      </form>
                      <Trash id={s.id} action={deleteSong} what="song" />
                    </li>
                  ))}
                </ul>
              ) : <Empty>No songs yet. The deck stays silent until you add one.</Empty>}
            </Panel>
          </div>
        </Section>
      </main>
    </AdminFrame>
  );
}
