"use server";
import { revalidatePath, updateTag } from "next/cache";
import { CONTENT_TAG } from "@/lib/content";
import { toContent, type Rows } from "@/lib/content/map";
import {
  checkProfile, checkNow, checkPlaces, checkStack, checkFaq, checkNumbers, checkLinks, checkWorkAuth,
  checkProject, checkExperience, checkEducation, type Errs,
} from "@/lib/content/validate";
import { adminClient } from "@/lib/supabase-server";
import { requireAuth } from "./auth-helper";
import {
  createProject, updateProject, createExperience, updateExperience, updateEducation, createEducation,
  upsertSiteContent, deleteProject, deleteExperience,
} from "./actions";

// Only async exports allowed here ("use server"); shared types are erased at build.
export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string; errors?: Errs };

export type EditProject = { id: string; slug: string; title: string; headline: string; kind: string; icon: string; ctx: string; desc: string[]; tags: string[];
  links: { label: string; url: string }[]; published: boolean };
export type EditRole = { id: string; slug: string; role: string; org: string; when: string; where: string; desc: string[]; tags: string[]; published: boolean };
export type EditData = {
  content: ReturnType<typeof toContent>; // effective values (DB or fixture fallback) for the site_content-backed sections
  projects: EditProject[]; // drafts included
  experience: EditRole[];
  education: { id: string | null; school: string; degree: string; focus: string; grad: string };
};
export type Section = "profile" | "now" | "places" | "stack" | "faq" | "numbers" | "links" | "workAuth";

const lines = (s?: string | null) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
const fail = (c: { ok: false; errors: Errs }): { ok: false; error: string; errors: Errs } => ({ ok: false, error: "Fix the highlighted fields.", errors: c.errors });
const fatal = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Save failed" });

/** Expires the ISR page and the getContent() cache so the save shows at once (same two calls as actions.ts). */
function bust() { revalidatePath("/"); updateTag(CONTENT_TAG); }

/** Writes a v7.* key directly: these are NOT embedded (no prose builder yet; CLAUDE.md), so skip upsertSiteContent. */
async function setV7(rows: Record<string, string>) {
  const { error } = await adminClient().from("site_content").upsert(Object.entries(rows).map(([key, value]) => ({ key, value })), { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/** Everything the edit window shows, in one read: all projects/experience incl. drafts, plus effective site copy. */
export async function loadEditData(): Promise<Result<EditData>> {
  await requireAuth();
  try {
    const db = adminClient();
    const [p, e, ed, s] = await Promise.all([
      db.from("projects").select("*").order("sort_order"), db.from("experience").select("*").order("sort_order"),
      db.from("education").select("*").order("sort_order"), db.from("site_content").select("key,value"),
    ]);
    const err = p.error ?? e.error ?? ed.error ?? s.error;
    if (err) throw new Error(err.message);
    const site = Object.fromEntries((s.data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
    const content = toContent({ projects: [], experience: [], education: ed.data as Rows["education"], site });
    // Same ordering the site uses: v7_order first, then sort_order.
    const prows = [...(p.data ?? [])].sort((a, b) => (a.v7_order ?? 99) - (b.v7_order ?? 99));
    const projects = prows.map((r): EditProject => ({
      id: r.id, slug: r.slug, title: r.title ?? "", headline: r.headline ?? "", kind: r.kind || r.badge || "", icon: r.icon || "cpu", ctx: r.ctx ?? "",
      desc: lines(r.description), tags: r.tags ?? [], published: !!r.published,
      links: Object.entries((r.links ?? {}) as Record<string, string>).map(([label, url]) => ({ label, url })),
    }));
    const experience = (e.data ?? []).map((r): EditRole => ({
      id: r.id, slug: r.slug, role: r.role ?? "", org: r.org ?? "", when: r.period || r.date_range || "", where: r.location ?? "",
      desc: lines(r.description), tags: r.tags ?? [], published: !!r.published,
    }));
    const row = ed.data?.[0];
    return { ok: true, data: { content, projects, experience, education: { id: row?.id ?? null, school: content.education.school, degree: content.education.degree, focus: content.education.focus, grad: content.education.grad } } };
  } catch (x) { return fatal(x); }
}

/** Saves one site_content-backed section: validates, then writes the keys exactly as lib/content/map.ts reads them. */
export async function saveSection(section: Section, input: unknown): Promise<Result> {
  await requireAuth();
  try {
    const J = JSON.stringify;
    switch (section) {
      case "profile": {
        const c = checkProfile(input); if (!c.ok) return fail(c);
        const v = c.value;
        await setV7({ "v7.role": v.role, "v7.status": v.status, "v7.line": v.line, "v7.thesis": J(v.thesis), "v7.about": J(v.about) }); break;
      }
      case "now": { const c = checkNow(input); if (!c.ok) return fail(c); await setV7({ "v7.now": J(c.value) }); break; }
      case "places": { const c = checkPlaces(input); if (!c.ok) return fail(c); await setV7({ "v7.places": J(c.value) }); break; }
      case "stack": {
        const c = checkStack(input); if (!c.ok) return fail(c);
        await setV7({ "v7.stack": J(Object.fromEntries(c.value.map((g) => [g.name, g.items]))) }); break;
      }
      case "faq": { const c = checkFaq(input); if (!c.ok) return fail(c); await setV7({ "v7.faq": J(c.value) }); break; }
      case "numbers": { const c = checkNumbers(input); if (!c.ok) return fail(c); await setV7({ "v7.numbers": J(c.value) }); break; }
      case "links": {
        // Existing keys that the RAG already knows (contact.link.*), so these go through the embedding path.
        const c = checkLinks(input); if (!c.ok) return fail(c);
        await upsertSiteContent("contact.link.email", c.value.email);
        await upsertSiteContent("contact.link.github", c.value.github);
        await upsertSiteContent("contact.link.linkedin", c.value.linkedin); break;
      }
      case "workAuth": { const c = checkWorkAuth(input); if (!c.ok) return fail(c); await upsertSiteContent("profile.work_authorization", c.value.workAuth); break; }
      default: return { ok: false, error: "Unknown section" };
    }
    bust();
    return { ok: true, data: null };
  } catch (x) { return fatal(x); }
}

/** Link rows → the DB's label→URL object. */
const linkObj = (l: { label: string; url: string }[]) => Object.fromEntries(l.map((x) => [x.label, x.url]));

/** Creates (id null) or updates a project from the v7 form; reuses the existing CRUD so RAG embedding stays in sync. */
export async function saveProject(id: string | null, input: unknown): Promise<Result<string>> {
  await requireAuth();
  const c = checkProject(input);
  if (!c.ok) return fail(c);
  try {
    const v = c.value;
    const fields = { slug: v.slug, title: v.title, badge: v.kind, headline: v.headline, kind: v.kind, icon: v.icon, ctx: v.ctx,
      description: v.desc.join("\n"), tags: v.tags, links: linkObj(v.links), published: v.published };
    if (id) { await updateProject(id, fields); return { ok: true, data: id }; }
    const { count } = await adminClient().from("projects").select("id", { count: "exact", head: true });
    const n = count ?? 0;
    const row = await createProject({ ...fields, image_url: null, featured: false, sort_order: n, v7_order: n });
    return { ok: true, data: row.id };
  } catch (x) { return fatal(x); }
}

/** Creates (id null) or updates an experience role from the v7 form. */
export async function saveExperience(id: string | null, input: unknown): Promise<Result<string>> {
  await requireAuth();
  const c = checkExperience(input);
  if (!c.ok) return fail(c);
  try {
    const v = c.value;
    const fields = { slug: v.slug, role: v.role, org: v.org, period: v.when, location: v.where || null, description: v.desc.join("\n"), tags: v.tags, published: v.published };
    if (id) { await updateExperience(id, { ...fields }); return { ok: true, data: id }; }
    const { count } = await adminClient().from("experience").select("id", { count: "exact", head: true });
    const row = await createExperience({ ...fields, org_url: null, type: "work", date_range: v.when, start_date: null, end_date: null, featured: false, sort_order: count ?? 0 });
    return { ok: true, data: row.id };
  } catch (x) { return fatal(x); }
}

/** Persists a new order: projects get v7_order (what v7 reads) and sort_order (old site); experience only has sort_order. */
export async function reorder(table: "projects" | "experience", ids: string[]): Promise<Result> {
  await requireAuth();
  if (!Array.isArray(ids) || ids.length > 200 || ids.some((i) => typeof i !== "string")) return { ok: false, error: "Invalid order" };
  try {
    const db = adminClient();
    const res = await Promise.all(ids.map((id, i) => db.from(table).update(table === "projects" ? { sort_order: i, v7_order: i } : { sort_order: i }).eq("id", id)));
    const bad = res.find((r) => r.error);
    if (bad?.error) throw new Error(bad.error.message);
    bust();
    return { ok: true, data: null };
  } catch (x) { return fatal(x); }
}

/** Deletes a project/experience row (and its embedding) after the auth check. */
export async function removeRow(table: "projects" | "experience", id: string): Promise<Result> {
  await requireAuth();
  try { await (table === "projects" ? deleteProject(id) : deleteExperience(id)); return { ok: true, data: null }; } catch (x) { return fatal(x); }
}

/** Saves the single education row (creating it if the table is empty). */
export async function saveEducation(id: string | null, input: unknown): Promise<Result> {
  await requireAuth();
  const c = checkEducation(input);
  if (!c.ok) return fail(c);
  try {
    const v = c.value;
    // The site has one education row; reuse it if the client didn't know its id (e.g. a second save
    // before reloading after the first create), so saves never duplicate the row.
    id ??= ((await adminClient().from("education").select("id").order("sort_order").limit(1)).data?.[0]?.id as string | undefined) ?? null;
    if (id) await updateEducation(id, { school: v.school, degree: v.degree, focus: v.focus, grad: v.grad } as never); // focus/grad are v7 columns, not in EducationInput
    else await createEducation({ school: v.school, school_url: null, degree: v.degree, concentrations: [], logo_path: null, sort_order: 0, published: true, ...{ focus: v.focus, grad: v.grad } } as never);
    return { ok: true, data: null };
  } catch (x) { return fatal(x); }
}
