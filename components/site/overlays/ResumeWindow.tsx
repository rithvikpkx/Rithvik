"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Window from "../windows/Window";
import { useSite } from "../SiteProvider";
import { useEditMode } from "@/components/EditModeProvider";
import { resumeSyncing, syncResumeNow, uploadResume } from "@/app/admin/resume-actions";

type Meta = { sha: string | null; syncedAt?: string; source?: "gdoc" | "upload"; pinned?: boolean };

/** Loads /api/resume/meta (null while loading or on failure, so the summary shows). `fresh` skips the CDN copy. */
function useResumeMeta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const load = useCallback((fresh = false) => {
    fetch(fresh ? `/api/resume/meta?t=${Date.now()}` : "/api/resume/meta")
      .then((r) => r.json()).then(setMeta).catch(() => setMeta({ sha: null }));
  }, []);
  useEffect(() => load(), [load]);
  return [meta, load] as const;
}

/** Edit-mode strip: Sync now / Upload PDF / Resume syncing (only while an upload is pinned), with a status line. */
function ResumeAdmin({ pinned, onChanged }: { pinned: boolean; onChanged: () => void }) {
  const [status, setStatus] = useState("");
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const run = (op: () => ReturnType<typeof syncResumeNow>) => start(async () => {
    setStatus("Working...");
    const r = await op();
    setStatus(r.status === "error" ? r.reason : r.status === "skipped" ? `Skipped: ${r.reason}`
      : (r.status === "updated" ? "Updated" : "Already up to date") + (r.embedError ? ` (agent text not refreshed: ${r.embedError})` : ""));
    onChanged();
  });
  return (
    <div className="resume-admin">
      <button type="button" className="ui-btn" disabled={busy} onClick={() => run(syncResumeNow)}>Sync now</button>
      <button type="button" className="ui-btn" disabled={busy} onClick={() => fileRef.current?.click()}>Upload PDF</button>
      {pinned && <button type="button" className="ui-btn" disabled={busy} onClick={() => run(resumeSyncing)}>Resume syncing</button>}
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = ""; // allow re-picking the same file
        if (!f) return;
        const fd = new FormData();
        fd.set("file", f);
        run(() => uploadResume(fd));
      }} />
      <span className="win-fine" role="status">{pinned && !status ? "Pinned upload: daily sync is paused" : status}</span>
    </div>
  );
}

/** The resume window: the synced PDF (Google Doc is master) when one exists, else a paper-style summary built from site content. */
export default function ResumeWindow() {
  const { content: c, close } = useSite();
  const { isEditing } = useEditMode();
  const [meta, reload] = useResumeMeta();
  const file = `${c.name.replace(/\s+/g, "-")}-Resume.pdf`;
  const e = c.education;
  const pdfUrl = meta?.sha ? `/resume.pdf?v=${meta.sha.slice(0, 12)}` : null;
  // iOS Safari renders framed PDFs badly (first page only), so phones get a link to a new tab instead.
  const phone = matchMedia("(max-width: 640px)").matches;
  const when = meta?.syncedAt && new Date(meta.syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <Window
      title={file} icon="file-text" label="Resume" className="resume-win" onClose={close}
      actions={pdfUrl && <a className="ui-btn" href={pdfUrl} download={file}>Download</a>}
    >
      {pdfUrl && !phone && <iframe className="pdf-frame" src={`${pdfUrl}#view=FitH`} title="Resume" />}
      {pdfUrl && phone && (
        <div className="pdf-viewport pdf-open"><a className="ui-btn" href={pdfUrl} target="_blank" rel="noopener">Open PDF</a></div>
      )}
      {!pdfUrl && <div className="pdf-viewport">
        <div className="pdf-page">
          <h1>{c.name.toUpperCase()}</h1>
          <p className="pc">{c.links.email} · {c.links.github.replace(/^https?:\/\//, "")} · rithvik.ai</p>
          <h2>Education</h2>
          <div className="pr"><span>{e.school}</span></div>
          <div className="pi"><span>{e.degree} · {e.focus}</span>{e.grad && <span>{e.grad}</span>}</div>
          <h2>Experience</h2>
          {c.experience.map((x) => (
            <div key={x.slug}>
              <div className="pr"><span>{x.org}</span><span>{x.where}</span></div>
              <div className="pi"><span>{x.role}</span><span>{x.when}</span></div>
              <ul>{x.desc.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          ))}
          <h2>Projects</h2>
          {c.projects.slice(0, 4).map((p) => (
            <div key={p.slug}>
              <div className="pr"><span>{p.title}</span><span>{p.tags.slice(0, 4).join(", ")}</span></div>
              <ul><li>{p.desc[0]}</li></ul>
            </div>
          ))}
          <h2>Skills</h2>
          <p>{Object.entries(c.stack).slice(0, 2).map(([k, v], i) => <span key={k}>{i ? " · " : ""}<b>{k}:</b> {v.join(", ")}</span>)}</p>
        </div>
      </div>}
      {isEditing && <ResumeAdmin pinned={!!meta?.pinned} onChanged={() => reload(true)} />}
      {/* Work authorization lives only here and in the agent: findable for whoever looks, never a headline. */}
      <p className="win-foot"><span>{pdfUrl ? `${meta?.source === "upload" ? "Uploaded" : "Synced from Google Docs"} · ${when}` : "Summary of the site content"}</span>{c.workAuth && <span className="win-fine">Work authorization: {c.workAuth}</span>}</p>
    </Window>
  );
}
