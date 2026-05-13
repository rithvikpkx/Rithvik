"use client";
import { useEffect, useState } from "react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import EditableTagList from "./EditableTagList";
import FadeIn from "./FadeIn";
import TimelineBeam from "./TimelineBeam";
import {
  createExperience,
  updateExperience,
  deleteExperience,
  type ExperienceInput,
} from "@/app/admin/actions";
import type { Experience } from "@/lib/types";

function toInput(e: Experience): ExperienceInput {
  return {
    slug: e.slug, org: e.org, org_url: e.org_url, role: e.role,
    type: e.type, date_range: e.date_range, start_date: e.start_date,
    end_date: e.end_date, description: e.description, tags: e.tags,
    location: e.location, featured: e.featured, published: e.published,
    sort_order: e.sort_order,
  };
}

export default function ExperienceClient({ initialEntries }: { initialEntries: Experience[] }) {
  const { isEditing } = useEditMode();
  const [entries, setEntries] = useState(initialEntries);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!isEditing) setEntries(initialEntries);
  }, [initialEntries, isEditing]);

  const patch = async (id: string, changes: Partial<ExperienceInput>) => {
    const prev = entries.find((e) => e.id === id)!;
    const updated = { ...prev, ...changes };
    setEntries((es) => es.map((e) => (e.id === id ? updated : e)));
    try {
      await updateExperience(id, toInput(updated));
    } catch {
      setEntries((es) => es.map((e) => (e.id === id ? prev : e)));
    }
  };

  const swap = async (idxA: number, idxB: number) => {
    const next = [...entries];
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    const reindexed = next.map((e, i) => ({ ...e, sort_order: i }));
    setEntries(reindexed);
    await Promise.all([
      updateExperience(reindexed[idxA].id, toInput(reindexed[idxA])),
      updateExperience(reindexed[idxB].id, toInput(reindexed[idxB])),
    ]);
  };

  const handleDelete = async (id: string) => {
    setEntries((es) => es.filter((e) => e.id !== id));
    setConfirmDelete(null);
    await deleteExperience(id);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const created = await createExperience({
        slug: `entry-${Date.now()}`,
        org: "Organization",
        org_url: null,
        role: "Role",
        type: "work",
        date_range: "2024 – Present",
        start_date: null,
        end_date: null,
        description: "Add a description…",
        tags: [],
        location: null,
        featured: false,
        published: false,
        sort_order: entries.length,
      });
      setEntries((es) => [...es, created]);
    } finally {
      setAdding(false);
    }
  };

  // ── Static (non-edit) view ──────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="timeline">
        <div className="timeline-beam"><TimelineBeam /></div>
        {entries.map(({ slug, org, date_range, role, description, tags }, i) => (
          <FadeIn key={slug} delay={i * 0.1} className="timeline-entry">
            <div className="timeline-dot" />
            <div className="timeline-content">
              <div className="timeline-header">
                <h3>{org}</h3>
                <span className="timeline-date">{date_range}</span>
              </div>
              <p className="timeline-role">{role}</p>
              <p className="timeline-desc">{description}</p>
              <div className="timeline-tags">
                {tags.map((t) => <span key={t}>{t}</span>)}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    );
  }

  // ── Edit view ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="timeline">
        {entries.map((entry, idx) => (
          <div key={entry.id} className="timeline-entry exp-entry-editing">
            <div className="timeline-dot" />
            <div className="timeline-content">

              {/* Controls */}
              <div className="proj-edit-bar">
                <div className="proj-sort-btns">
                  <button className="proj-sort-btn" onClick={() => swap(idx, idx - 1)} disabled={idx === 0}>↑</button>
                  <button className="proj-sort-btn" onClick={() => swap(idx, idx + 1)} disabled={idx === entries.length - 1}>↓</button>
                </div>
                <div className="proj-toggles">
                  <label className="proj-toggle">
                    <input type="checkbox" checked={entry.published} onChange={(e) => patch(entry.id, { published: e.target.checked })} />
                    Published
                  </label>
                  <label className="proj-toggle">
                    <input type="checkbox" checked={entry.featured} onChange={(e) => patch(entry.id, { featured: e.target.checked })} />
                    Featured
                  </label>
                </div>
                <button className="proj-delete-btn" onClick={() => setConfirmDelete(entry.id)} aria-label="Delete">✕</button>
              </div>

              {confirmDelete === entry.id && (
                <div className="proj-delete-confirm">
                  <span>Delete &ldquo;{entry.org}&rdquo;?</span>
                  <button className="btn-danger-sm" onClick={() => handleDelete(entry.id)}>Delete</button>
                  <button className="btn-ghost-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                </div>
              )}

              {/* Header: org + date */}
              <div className="timeline-header">
                <EditableText tag="h3" value={entry.org}
                  onSave={(v) => patch(entry.id, { org: v })} placeholder="Organization…" />
                <EditableText tag="span" className="timeline-date" value={entry.date_range}
                  onSave={(v) => patch(entry.id, { date_range: v })} placeholder="2024 – Present" />
              </div>

              {/* Role + optional org URL */}
              <EditableText tag="p" className="timeline-role" value={entry.role}
                onSave={(v) => patch(entry.id, { role: v })} placeholder="Role…" />

              {/* Extra metadata only visible in edit mode */}
              <div className="exp-meta-row">
                <EditableText tag="span" className="exp-meta-field" value={entry.org_url ?? ""}
                  onSave={(v) => patch(entry.id, { org_url: v || null })} placeholder="org URL…" />
                <EditableText tag="span" className="exp-meta-field" value={entry.location ?? ""}
                  onSave={(v) => patch(entry.id, { location: v || null })} placeholder="Location…" />
              </div>

              <EditableText tag="p" className="timeline-desc" value={entry.description}
                onSave={(v) => patch(entry.id, { description: v })} placeholder="Description…" multiline />

              <EditableTagList tags={entry.tags}
                onSave={(tags) => patch(entry.id, { tags })} className="timeline-tags" />
            </div>
          </div>
        ))}
      </div>

      <div className="proj-add-row">
        <button className="proj-add-btn" onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "+ Add Entry"}
        </button>
      </div>
    </div>
  );
}
