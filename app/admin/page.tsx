import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase";
import type { Project, Experience } from "@/lib/types";
import ProjectManager from "./ProjectManager";
import ExperienceManager from "./ExperienceManager";

async function getUser() {
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
  return user;
}

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/admin/login");

  // Service role — fetches all rows including drafts
  const [{ data: projectData }, { data: experienceData }] = await Promise.all([
    serverClient().from("projects").select("*").order("sort_order"),
    serverClient().from("experience").select("*").order("sort_order"),
  ]);
  const projects = (projectData ?? []) as Project[];
  const experiences = (experienceData ?? []) as Experience[];

  return (
    <div className="admin-page">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <div>
            <p className="admin-eyebrow">Admin</p>
            <h1 className="admin-page-title">Dashboard</h1>
          </div>
          <div className="admin-topbar-right">
            <p className="admin-user-email">{user.email}</p>
            <a href="/admin/logout" className="admin-logout-btn">Sign out</a>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <ProjectManager projects={projects} />
        <ExperienceManager experiences={experiences} />
      </main>
    </div>
  );
}
