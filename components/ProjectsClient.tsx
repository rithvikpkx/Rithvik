"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import EditableTagList from "./EditableTagList";
import {
  createProject,
  updateProject,
  deleteProject,
  type ProjectInput,
} from "@/app/admin/actions";
import type { Project } from "@/lib/types";

const FALLBACK_LINK = "https://github.com/rithvikpkx";

/** Pick the most useful external URL for a project card: github > live > demo > fallback. */
function primaryLink(links: Record<string, string>): string {
  return links.github || links.live || links.demo || FALLBACK_LINK;
}

/** Strips server-generated fields to produce a ProjectInput for server actions. */
function toInput(p: Project): ProjectInput {
  return {
    slug: p.slug, title: p.title, badge: p.badge, description: p.description,
    tags: p.tags, links: p.links, image_url: p.image_url,
    featured: p.featured, published: p.published, sort_order: p.sort_order,
  };
}

export default function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const { isEditing } = useEditMode();
  const [projects, setProjects] = useState(initialProjects);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Sync server data back in when not editing (catches revalidation updates)
  useEffect(() => {
    if (!isEditing) setProjects(initialProjects);
  }, [initialProjects, isEditing]);

  const patch = async (id: string, changes: Partial<ProjectInput>) => {
    const prev = projects.find((p) => p.id === id)!;
    const updated = { ...prev, ...changes };
    setProjects((ps) => ps.map((p) => (p.id === id ? updated : p)));
    try {
      await updateProject(id, toInput(updated));
    } catch {
      setProjects((ps) => ps.map((p) => (p.id === id ? prev : p)));
    }
  };

  const swap = async (idxA: number, idxB: number) => {
    const next = [...projects];
    [next[idxA], next[idxB]] = [next[idxB], next[idxA]];
    const reindexed = next.map((p, i) => ({ ...p, sort_order: i }));
    setProjects(reindexed);
    await Promise.all([
      updateProject(reindexed[idxA].id, toInput(reindexed[idxA])),
      updateProject(reindexed[idxB].id, toInput(reindexed[idxB])),
    ]);
  };

  const handleDelete = async (id: string) => {
    setProjects((ps) => ps.filter((p) => p.id !== id));
    setConfirmDelete(null);
    await deleteProject(id);
  };

  const handleAdd = async () => {
    setAdding(true);
    try {
      const created = await createProject({
        slug: `project-${Date.now()}`,
        title: "New Project",
        badge: "New",
        description: "Add a description…",
        tags: [],
        links: {},
        image_url: null,
        featured: false,
        published: false,
        sort_order: projects.length,
      });
      setProjects((ps) => [...ps, created]);
    } finally {
      setAdding(false);
    }
  };

  // ── Static (non-edit) view ──────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="projects-grid">
        {projects.map(({ slug, badge, title, description, tags, links }, i) => (
          <motion.a
            key={slug}
            href={primaryLink(links)}
            target="_blank"
            rel="noopener noreferrer"
            className="project-card project-card-link"
            initial={{ opacity: 0, filter: "blur(10px)", y: 18 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.65, ease: "easeOut", delay: i * 0.1 }}
          >
            <div className="project-header">
              <span className="project-badge">{badge}</span>
              <span className="project-link-arrow" aria-hidden="true">↗</span>
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
            <div className="project-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          </motion.a>
        ))}
      </div>
    );
  }

  // ── Edit view ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="projects-grid">
        {projects.map((project, idx) => (
          <div key={project.id} className="project-card project-card-editing">

            {/* Controls: sort, toggles, delete */}
            <div className="proj-edit-bar">
              <div className="proj-sort-btns">
                <button className="proj-sort-btn" onClick={() => swap(idx, idx - 1)} disabled={idx === 0}>↑</button>
                <button className="proj-sort-btn" onClick={() => swap(idx, idx + 1)} disabled={idx === projects.length - 1}>↓</button>
              </div>
              <div className="proj-toggles">
                <label className="proj-toggle">
                  <input type="checkbox" checked={project.published} onChange={(e) => patch(project.id, { published: e.target.checked })} />
                  Published
                </label>
                <label className="proj-toggle">
                  <input type="checkbox" checked={project.featured} onChange={(e) => patch(project.id, { featured: e.target.checked })} />
                  Featured
                </label>
              </div>
              <button className="proj-delete-btn" onClick={() => setConfirmDelete(project.id)} aria-label="Delete">✕</button>
            </div>

            {/* Delete confirmation inline */}
            {confirmDelete === project.id && (
              <div className="proj-delete-confirm">
                <span>Delete &ldquo;{project.title}&rdquo;?</span>
                <button className="btn-danger-sm" onClick={() => handleDelete(project.id)}>Delete</button>
                <button className="btn-ghost-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
              </div>
            )}

            {/* Editable card fields */}
            <div className="project-header">
              <EditableText tag="span" className="project-badge" value={project.badge}
                onSave={(v) => patch(project.id, { badge: v })} placeholder="Badge…" />
            </div>
            <EditableText tag="h3" value={project.title}
              onSave={(v) => patch(project.id, { title: v })} placeholder="Title…" />
            <EditableText tag="p" value={project.description}
              onSave={(v) => patch(project.id, { description: v })} placeholder="Description…" multiline />
            <EditableTagList tags={project.tags}
              onSave={(tags) => patch(project.id, { tags })} className="project-tags" />
          </div>
        ))}
      </div>

      <div className="proj-add-row">
        <button className="proj-add-btn" onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "+ Add Project"}
        </button>
      </div>
    </div>
  );
}
