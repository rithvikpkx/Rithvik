"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Experience } from "@/lib/types";
import { createExperience, updateExperience, deleteExperience, type ExperienceInput } from "./actions";

interface Props { experiences: Experience[]; }

interface FormState {
  slug: string;
  org: string;
  org_url: string;
  role: string;
  type: string;
  date_range: string;
  start_date: string;
  end_date: string;
  description: string;
  tags: string;
  location: string;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

function emptyForm(): FormState {
  return {
    slug: "", org: "", org_url: "", role: "", type: "work",
    date_range: "", start_date: "", end_date: "",
    description: "", tags: "", location: "",
    featured: false, published: true, sort_order: 0,
  };
}

function experienceToForm(e: Experience): FormState {
  return {
    slug: e.slug,
    org: e.org,
    org_url: e.org_url ?? "",
    role: e.role,
    type: e.type,
    date_range: e.date_range,
    start_date: e.start_date ?? "",
    end_date: e.end_date ?? "",
    description: e.description,
    tags: e.tags.join(", "),
    location: e.location ?? "",
    featured: e.featured,
    published: e.published,
    sort_order: e.sort_order,
  };
}

function formToInput(f: FormState): ExperienceInput {
  return {
    slug: f.slug.trim(),
    org: f.org.trim(),
    org_url: f.org_url.trim() || null,
    role: f.role.trim(),
    type: f.type,
    date_range: f.date_range.trim(),
    start_date: f.start_date.trim() || null,
    end_date: f.end_date.trim() || null,
    description: f.description.trim(),
    tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
    location: f.location.trim() || null,
    featured: f.featured,
    published: f.published,
    sort_order: f.sort_order,
  };
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function ExperienceForm({
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
      if (field === "org" && (prev.slug === "" || prev.slug === slugify(prev.org))) {
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
          <label>Organisation</label>
          <input value={form.org} onChange={(e) => set("org", e.target.value)} required placeholder="Purdue University" />
        </div>
        <div className="admin-field">
          <label>Slug</label>
          <input value={form.slug} onChange={(e) => set("slug", e.target.value)} required placeholder="url-slug" />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>Role / Title</label>
          <input value={form.role} onChange={(e) => set("role", e.target.value)} required placeholder="Software Engineer Intern" />
        </div>
        <div className="admin-field">
          <label>Type</label>
          <select value={form.type} onChange={(e) => set("type", e.target.value)} className="admin-select">
            <option value="work">Work</option>
            <option value="education">Education</option>
            <option value="project">Project</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>Date Range</label>
          <input value={form.date_range} onChange={(e) => set("date_range", e.target.value)} required placeholder="Aug 2023 — Present" />
        </div>
        <div className="admin-field">
          <label>Location</label>
          <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="West Lafayette, IN" />
        </div>
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>Start Date</label>
          <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
        </div>
        <div className="admin-field">
          <label>End Date</label>
          <input type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
        </div>
      </div>

      <div className="admin-field">
        <label>Description</label>
        <textarea value={form.description} onChange={(e) => set("description", e.target.value)} required rows={3} placeholder="What did you do here?" />
      </div>

      <div className="admin-field">
        <label>Tags (comma-separated)</label>
        <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="TypeScript, React, AI" />
      </div>

      <div className="admin-field">
        <label>Organisation URL</label>
        <input value={form.org_url} onChange={(e) => set("org_url", e.target.value)} placeholder="https://..." />
      </div>

      <div className="admin-form-row">
        <div className="admin-field">
          <label>Sort Order</label>
          <input type="number" value={form.sort_order} onChange={(e) => set("sort_order", Number(e.target.value))} />
        </div>
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

export default function ExperienceManager({ experiences }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleCreate(form: FormState) {
    await createExperience(formToInput(form));
    setAdding(false);
    router.refresh();
  }

  async function handleUpdate(id: string, form: FormState) {
    await updateExperience(id, formToInput(form));
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: string, org: string) {
    if (!confirm(`Delete "${org}"? This cannot be undone.`)) return;
    await deleteExperience(id);
    router.refresh();
  }

  return (
    <div className="admin-section">
      <div className="admin-section-header">
        <h2 className="admin-section-title">Experience</h2>
        {!adding && (
          <button className="admin-add-btn" onClick={() => { setAdding(true); setEditingId(null); }}>
            + Add Entry
          </button>
        )}
      </div>

      {adding && (
        <div className="admin-card">
          <p className="admin-card-label">New Entry</p>
          <ExperienceForm
            initial={emptyForm()}
            onSubmit={handleCreate}
            onCancel={() => setAdding(false)}
            submitLabel="Create Entry"
          />
        </div>
      )}

      <div className="admin-project-list">
        {experiences.length === 0 && !adding && (
          <p className="admin-empty">No experience entries yet. Add one above.</p>
        )}
        {experiences.map((exp) => (
          <div key={exp.id} className="admin-card">
            {editingId === exp.id ? (
              <>
                <p className="admin-card-label">Editing</p>
                <ExperienceForm
                  initial={experienceToForm(exp)}
                  onSubmit={(form) => handleUpdate(exp.id, form)}
                  onCancel={() => setEditingId(null)}
                  submitLabel="Save Changes"
                />
              </>
            ) : (
              <div className="admin-project-row">
                <div className="admin-project-info">
                  <div className="admin-project-meta">
                    <span className="admin-badge">{exp.type}</span>
                    {!exp.published && <span className="admin-draft">Draft</span>}
                    {exp.featured && <span className="admin-featured">Featured</span>}
                  </div>
                  <h3 className="admin-project-title">{exp.org}</h3>
                  <p className="admin-project-slug">{exp.role} · {exp.date_range}</p>
                  <div className="admin-project-tags">
                    {exp.tags.map((t) => <span key={t}>{t}</span>)}
                  </div>
                </div>
                <div className="admin-row-actions">
                  <button
                    className="admin-edit-btn"
                    onClick={() => { setEditingId(exp.id); setAdding(false); }}
                  >
                    Edit
                  </button>
                  <button
                    className="admin-delete-btn"
                    onClick={() => handleDelete(exp.id, exp.org)}
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
