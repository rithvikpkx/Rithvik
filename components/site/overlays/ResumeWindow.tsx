"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { track } from "@/lib/track/bus";
import Window from "../windows/Window";
import { useSite } from "../SiteProvider";
import { useEditMode } from "@/components/EditModeProvider";
import { resumeSyncing, syncResumeNow, uploadResume } from "@/app/admin/resume-actions";

type Meta = { sha: string | null; syncedAt?: string; source?: "gdoc" | "upload"; pinned?: boolean };

/** Loads /api/resume/meta (null while loading; `{ sha: null }` on failure, so the summary shows). `fresh` skips the CDN copy. */
export function useResumeMeta() {
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
      : (r.status === "updated" ? "Updated" : "Already up to date"));
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
  const { content: c, close: closeLayer } = useSite();
  const close = () => closeLayer("resume");
  const { isEditing } = useEditMode();
  const [meta, reload] = useResumeMeta();
  const file = `${c.name.replace(/\s+/g, "-")}-Resume.pdf`;
  const e = c.education;
  const pdfUrl = meta?.sha ? `/resume.pdf?v=${meta.sha.slice(0, 12)}` : null;
  // iOS Safari renders framed PDFs badly (first page only), so phones get a link to a new tab instead.
  const phone = matchMedia("(max-width: 640px)").matches;
  // the frame stays invisible until the PDF has painted, so the visitor never sees anything but the real resume;
  // the timeout is a safety net for a viewer that never fires load
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!pdfUrl || phone) return; const t = setTimeout(() => setReady(true), 8000); return () => clearTimeout(t); }, [pdfUrl, phone]);
  // the synced Google Doc shows as real page content (/resume.html), which session replays can record and phones
  // render; an uploaded PDF, or a failed export, uses the PDF viewer
  const [docFailed, setDocFailed] = useState(false);
  // How long the resume stayed open and how far down it was read (the HTML view reports its scroll), on close.
  const depth = useRef(0);
  useEffect(() => {
    const t0 = Date.now();
    return () => track("resume", { action: "close", ms: Date.now() - t0, ...(depth.current ? { pct: depth.current } : {}) });
  }, []);
  const watchDepth = (f: HTMLIFrameElement) => {
    const w = f.contentWindow, d = f.contentDocument?.documentElement;
    if (!w || !d) return;
    w.addEventListener("scroll", () => { depth.current = Math.max(depth.current, Math.round(((w.scrollY + w.innerHeight) / d.scrollHeight) * 100)); }, { passive: true });
  };
  const docUrl = meta?.source !== "upload" && meta?.sha && !docFailed ? `/resume.html?v=${meta.sha.slice(0, 12)}` : null;
  const showPdf = !!pdfUrl && !docUrl;
  const loading = !meta || (docUrl ? !ready : showPdf && !phone && !ready);
  const when = meta?.syncedAt && new Date(meta.syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return (
    <Window
      title={file} icon="file-text" label="Resume" name="resume" className="resume-win" onClose={close}
      actions={pdfUrl && <>{docUrl && <a className="ui-btn" href={pdfUrl} target="_blank" rel="noopener">Open PDF</a>}<a className="ui-btn" href={pdfUrl} download={file}>Download</a></>}
    >
      {loading && <ResumeSkeleton />}
      {docUrl && <iframe className="pdf-frame doc-frame" src={docUrl} title="Resume" data-loading={loading || undefined} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={(e) => { const t = e.currentTarget.contentDocument?.body?.innerText ?? ""; if (t.length < 80) setDocFailed(true); else { setReady(true); watchDepth(e.currentTarget); } }} />}
      {showPdf && !phone && <iframe className="pdf-frame" src={`${pdfUrl}#view=FitH`} title="Resume" data-loading={loading || undefined} onLoad={() => setReady(true)} />}
      {showPdf && phone && (
        <div className="pdf-viewport pdf-open"><a className="ui-btn" href={pdfUrl} target="_blank" rel="noopener">Open PDF</a></div>
      )}
      {meta && !pdfUrl && <div className="pdf-viewport">
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
      <p className="win-foot"><span>{loading ? "Loading the latest resume…" : pdfUrl ? `${meta?.source === "upload" ? "Uploaded" : "Synced from Google Docs"} · ${when}` : "Summary of the site content"}</span>{c.workAuth && <span className="win-fine">Work authorization: {c.workAuth}</span>}</p>
    </Window>
  );
}

/** A grey wireframe of a resume page, shown until the real PDF (or, without one, the summary) is ready. */
export function ResumeSkeleton() {
  const block = (lines: number[]) => lines.map((w, i) => <i key={i} style={{ width: `${w}%` }} />);
  return (
    <div className="pdf-viewport" aria-busy="true" aria-label="Loading resume">
      <div className="pdf-page pdf-skel" aria-hidden="true">
        <b className="sk-h1" /><i className="sk-c" style={{ width: "62%" }} />
        {[[92, 70], [96, 88, 74, 90], [94, 82, 66], [90, 58]].map((lines, k) => (
          <div key={k}><b className="sk-h2" />{block(lines)}</div>
        ))}
      </div>
    </div>
  );
}
