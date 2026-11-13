"use client";
import { useState } from "react";
import EditContentUI, { type EditApi } from "@/components/site/edit/EditContentUI";
import type { EditData, Result } from "@/app/admin/content-actions";
import { fixture } from "@/lib/content/fixture";
import { checkProfile, checkProject } from "@/lib/content/validate";

const lag = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 350));
const data: EditData = {
  content: fixture,
  projects: [
    ...fixture.projects.map((p, i) => ({ ...p, id: `p${i}`, links: Object.entries(p.links).map(([label, url]) => ({ label, url })), published: true })),
    { id: "pd", slug: "secret-thing", title: "Secret thing (draft)", headline: "Not public yet", kind: "Idea", icon: "cpu", ctx: "", desc: ["Half-baked"], tags: [], links: [], published: false },
  ],
  experience: [
    ...fixture.experience.map((e, i) => ({ ...e, id: `e${i}`, published: true })),
    { id: "ed", slug: "draft-role", role: "Draft role", org: "Somewhere", when: "2027", where: "", desc: ["TBD"], tags: [], published: false },
  ],
  education: { id: "edu", ...fixture.education },
};
/** In-memory stand-ins for the server actions. Profile role "FAIL" or project slug "fail-me" simulates a server error; ?failReorder=1 fails reorders. */
const api: EditApi = {
  load: () => lag<Result<EditData>>({ ok: true, data }),
  saveSection: async (s, v) => {
    console.log("saveSection", s, JSON.stringify(v));
    if (s === "profile") { const c = checkProfile(v); if (c.ok && c.value.role === "FAIL") return lag<Result>({ ok: false, error: "Database unreachable" }); }
    return lag<Result>({ ok: true, data: null });
  },
  saveProject: async (id, v) => { const c = checkProject(v); if (c.ok && c.value.slug === "fail-me") return lag<Result<string>>({ ok: false, error: "Slug already exists" }); return lag<Result<string>>({ ok: true, data: id ?? "new1" }); },
  saveExperience: async (id) => lag<Result<string>>({ ok: true, data: id ?? "new2" }),
  saveEducation: async () => lag<Result>({ ok: true, data: null }),
  reorder: async () => lag<Result>(new URLSearchParams(location.search).has("failReorder") ? { ok: false, error: "Order not saved" } : { ok: true, data: null }),
  removeRow: async () => lag<Result>({ ok: true, data: null }),
};

/** Lab-only: the Edit content window with fixture data and stubbed actions (no auth, no DB). */
export default function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <main style={{ padding: 32 }}>
      <button className="ui-btn" onClick={() => setOpen(true)}>Edit content</button>
      <p style={{ color: "var(--ui-muted)" }}>Lab: edit window harness. Background text to test non-modal windows.</p>
      {open && <EditContentUI api={api} onClose={() => setOpen(false)} />}
    </main>
  );
}
