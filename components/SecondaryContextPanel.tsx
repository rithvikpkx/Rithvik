"use client";
import { useEffect, useState, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  listSecondaryDocuments,
  uploadSecondaryDocument,
  deleteSecondaryDocument,
  backfillPrimaryEmbeddings,
  type SecondaryDocRow,
} from "@/app/admin/rag-actions";
import { useEditMode } from "./EditModeProvider";

/**
 * Floating panel for managing the RAG bot's secondary context store.
 *
 * Only mounted when EditModeProvider says isEditing is true. Sits to the
 * left of the RAG chat launcher (bottom-right) so its association with the
 * bot is visually obvious. Three jobs:
 *   1. Show the current list of secondary documents with chunk counts.
 *   2. Accept new uploads (click or drag-drop), one at a time.
 *   3. Trigger a full re-embed of primary content when needed.
 */
export default function SecondaryContextPanel() {
  const { isEditing } = useEditMode();
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<SecondaryDocRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);          // upload status text
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  async function refresh() {
    try { setDocs(await listSecondaryDocuments()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    for (const file of list) {
      setBusy(`Uploading ${file.name}…`);
      try {
        const fd = new FormData();
        fd.set("file", file);
        await uploadSecondaryDocument(fd);
      } catch (e) {
        setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(null);
    await refresh();
  }

  async function handleDelete(id: string, filename: string) {
    if (!confirm(`Delete "${filename}" from RAG context?`)) return;
    setError(null);
    setBusy(`Deleting ${filename}…`);
    try { await deleteSecondaryDocument(id); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(null);
    await refresh();
  }

  async function handleBackfill() {
    if (!confirm("Re-embed all primary content? Existing primary embeddings will be replaced.")) return;
    setError(null);
    setBusy("Re-embedding primary content…");
    try {
      const report = await backfillPrimaryEmbeddings();
      const total = report.projects + report.experience + report.education + report.site_content;
      const summary = `Re-embedded ${total} primary rows (${report.projects}p / ${report.experience}e / ${report.education}ed / ${report.site_content}s).`;
      setBusy(report.errors.length ? `${summary} ${report.errors.length} error(s).` : summary);
      setTimeout(() => setBusy(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) startTransition(() => { handleFiles(e.dataTransfer.files); });
  }

  if (!isEditing) return null;

  return (
    <div className="ctx-launcher" aria-label="Secondary context panel">
      <AnimatePresence>
        {open && (
          <motion.div
            className="ctx-panel"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <div className="ctx-header">
              <div className="ctx-title-group">
                <span className="ctx-title">RAG Context</span>
                <span className="ctx-subtitle">Secondary materials</span>
              </div>
              <button className="ctx-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>

            <div className={`ctx-dropzone${dragOver ? " is-over" : ""}`}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept=".txt,.md,.pdf,.docx,image/*"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <button className="ctx-upload-btn" onClick={() => fileInputRef.current?.click()}>
                + Upload files
              </button>
              <p className="ctx-hint">Drag-and-drop or click — PDF, DOCX, TXT, MD, images.</p>
            </div>

            <ul className="ctx-list">
              {docs.length === 0 && <li className="ctx-empty">No secondary documents yet.</li>}
              {docs.map((d) => (
                <li key={d.id} className="ctx-item">
                  <div className="ctx-item-main">
                    <span className="ctx-item-name" title={d.filename}>{d.filename}</span>
                    <span className="ctx-item-meta">
                      {fmtBytes(d.byte_size)} · {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button className="ctx-item-del" onClick={() => handleDelete(d.id, d.filename)} aria-label={`Delete ${d.filename}`}>✕</button>
                </li>
              ))}
            </ul>

            <div className="ctx-footer">
              <button className="ctx-backfill" onClick={handleBackfill}>Re-embed all primary content</button>
              {busy  && <p className="ctx-status">{busy}</p>}
              {error && <p className="ctx-error">{error}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="ctx-btn" onClick={() => setOpen((o) => !o)} aria-label="Manage RAG context">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M4 7h16M4 12h16M4 17h10" />
        </svg>
        <span>Context</span>
      </button>
    </div>
  );
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
