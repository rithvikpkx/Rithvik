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
  const { error } = await adminClient().from("projects").insert(data);
  if (error) throw new Error(error.message);
  revalidate();
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
