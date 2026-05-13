"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/types";
import { createProject, updateProject, deleteProject, type ProjectInput } from "./actions";

interface Props { projects: Project[]; }

interface FormState {
  slug: string;
  title: string;
  badge: string;
  description: string;
  tags: string;
  github: string;
  live: string;
  image_url: string;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

function emptyForm(): FormState {
  return { slug: "", title: "", badge: "", description: "", tags: "", github: "", live: "", image_url: "", featured: false, published: true, sort_order: 0 };
}

function projectToForm(p: Project): FormState {
  return {
    slug: p.slug,
    title: p.title,
    badge: p.badge,
    description: p.description,
    tags: p.tags.join(", "),
    github: (p.links as Record<string, string>).github ?? "",
    live: (p.links as Record<string, string>).live ?? "",
    image_url: p.image_url ?? "",
    featured: p.featured,
    published: p.published,
    sort_order: p.sort_order,
  };
}

function formToInput(f: FormState): ProjectInput {
  const links: Record<string, string> = {};
  if (f.github) links.github = f.github;
  if (f.live) links.live = f.live;
  return {
    slug: f.slug.trim(),
    title: f.title.trim(),
    badge: f.badge.trim(),
    description: f.description.trim(),
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    links,
    image_url: f.image_url.trim() || null,
    featured: f.featured,
    published: f.published,
    sort_order: f.sort_order,
  };
}

function slugify(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: FormState;
  onSubmit: (f: FormState) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: keyof FormState, value: string | boolean | number) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // auto-fill slug from title if slug is empty or was auto-generated
      if (field === "title" && (prev.slug === "" || prev.slug === slugify(prev.title))) {
        next.slug = slugify(value as string);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <form className="admin-project-form" onSubmit={handleSubmit}>
      <div className="admin-form-row">
        <div className="admin-field">
          <label>Title</label>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder="Project title" />
        </div>
        <div className="admin-field">
          <label>Slug</label>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} required placeholder="url-slug" />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>Badge</label>
          <input value={form.badge} onChange={(e) => set("badge", e.target.value)} required placeholder="e.g. In Progress" />
        </div>
        <div className="admin-field">
          <label>Sort Order</label>
          <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
        </div>
      </div>

      <div className="admin-field">
        <label>Description</label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} required rows={3} placeholder="What does this project do?" />
      </div>

      <div className="admin-field">
        <label>Tags (comma-separated)</label>
        <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="React, TypeScript, Supabase" />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>GitHub URL</label>
          <input value={form.github} onChange={(e) => set("github", e.target.value)} placeholder="https://github.com/..." />
        </div>
        <div className="admin-field">
          <label>Live URL</label>
          <input value={form.live} onChange={(e) => set("live", e.target.value)} placeholder="https://..." />
        </div>
      </div>

      <div className="admin-field">
        <label>Image URL</label>
        <input value={form.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://..." />
      </div>

      <div className="admin-form-checks">
        <label className="admin-check">
          <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
          Published
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
          Featured
        </label>
      </div>

      {error && <p className="admin-error">{error}</p>}

      <div className="admin-form-actions">
        <button type="submit" className="admin-submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
        <button type="button" className="admin-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function ProjectManager({ projects }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleCreate(form: FormState) {
    await createProject(formToInput(form));
    setAdding(false);
    router.refresh();
  }

  async function handleUpdate(id: string, form: FormState) {
    await updateProject(id, formToInput(form));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    await deleteProject(id);
    router.refresh();
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Projects</h2>
        {!adding && (
          <button className="admin-add-btn" onClick={() => { setAdding(true); setEditingId(null); }}>
            + Add Project
          </button>
        )}
      </div>

      {adding && (
        <div className="admin-card">
          <p className="admin-card-label">New Project</p>
          <ProjectForm
            initial={emptyForm()}
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
            submitLabel="Create Project"
          />
        </div>
      )}

      <div className="admin-project-list">
        {projects.length === 0 && !adding && (
          <p className="admin-empty">No projects yet. Add one above.</p>
        )}
        {projects.map((p) => (
          <div key={p.id} className="admin-card">
            {editingId === p.id ? (
              <>
                <p className="admin-card-label">Editing</p>
                <ProjectForm
                  initial={projectToForm(p)}
                  onSubmit={(form) => handleUpdate(p.id, form)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save Changes"
                />
              </>
            ) : (
              <div className="admin-project-row">
                <div className="admin-project-info">
                  <div className="admin-project-meta">
                    <span className="admin-badge">{p.badge}</span>
                    {!p.published && <span className="admin-draft">Draft</span>}
                    {p.featured && <span className="admin-featured">Featured</span>}
                  </div>
                  <h3 className="admin-project-title">{p.title}</h3>
                  <p className="admin-project-slug">/{p.slug}</p>
                  <div className="admin-project-tags">
                    {p.tags.map((t) => <span key={t}>{t}</span>)}
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button
                    className="admin-edit-btn"
                    onClick={() => { setEditingId(p.id); setAdding(false); }}
                  >
                    Edit
                  </button>
                  <button
                    className="admin-delete-btn"
                    onClick={() => handleDelete(p.id, p.title)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
