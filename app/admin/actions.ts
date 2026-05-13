"use server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminClient } from "@/lib/supabase";

export interface ProjectInput {
  slug: string;
  title: string;
  badge: string;
  description: string;
  tags: string[];
  links: Record<string, string>;
  image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

/** Verifies an active session exists, redirects to login if not. */
async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user;
}

function revalidate() {
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function createProject(data: ProjectInput) {
  await requireAuth();
  const { data: created, error } = await adminClient()
    .from("projects")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidate();
  return created;
}

export async function updateProject(id: string, data: ProjectInput) {
  await requireAuth();
  const { error } = await adminClient().from("projects").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deleteProject(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export interface ExperienceInput {
  slug: string;
  org: string;
  org_url: string | null;
  role: string;
  type: string;
  date_range: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  tags: string[];
  location: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
}

export async function createExperience(data: ExperienceInput) {
  await requireAuth();
  const { error } = await adminClient().from("experience").insert(data);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function updateExperience(id: string, data: ExperienceInput) {
  await requireAuth();
  const { error } = await adminClient().from("experience").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deleteExperience(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("experience").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

/** Upsert a single key/value pair into the site_content table. */
export async function upsertSiteContent(key: string, value: string) {
  await requireAuth();
  const { error } = await adminClient()
    .from("site_content")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidate();
}

export interface EducationInput {
  school: string;
  school_url: string | null;
  degree: string;
  concentrations: string[];
  logo_path: string | null;
  sort_order: number;
  published: boolean;
}

export async function createEducation(data: EducationInput) {
  await requireAuth();
  const { error } = await adminClient().from("education").insert(data);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function updateEducation(id: string, data: Partial<EducationInput>) {
  await requireAuth();
  const { error } = await adminClient().from("education").update(data).eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}

export async function deleteEducation(id: string) {
  await requireAuth();
  const { error } = await adminClient().from("education").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidate();
}
