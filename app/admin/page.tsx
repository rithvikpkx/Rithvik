import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

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

  return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <p className="admin-eyebrow">Admin</p>
        <h1 className="admin-login-title">Welcome back, Rithvik.</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "8px" }}>
          Signed in as {user.email}
        </p>
        <a href="/admin/logout" className="admin-submit" style={{ marginTop: "32px", textAlign: "center" }}>
          Sign out
        </a>
      </div>
    </div>
  );
}
