import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** The single address allowed to edit the site. Prefer the server-only
 *  ADMIN_EMAIL; fall back to the NEXT_PUBLIC_ one that the login panel already
 *  uses, so existing deployments keep working without a new env var. */
function adminEmail(): string {
  return (process.env.ADMIN_EMAIL ?? process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
}

/** Verifies an active session exists AND that it belongs to the admin, else
 *  redirects to /. Used by every server action in this directory. Lives in its
 *  own module so it can be imported from both actions.ts and rag-actions.ts
 *  without circular deps.
 *
 *  The email check matters because a Supabase session only proves "some user
 *  signed in to this project", not "Rithvik signed in". The allow-list in
 *  EditModeProvider runs in the browser and is trivially bypassed, so this is
 *  the only place the identity is actually enforced. */
export async function requireAuth() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        // requireAuth is read-only — mutating cookies here is disallowed by
        // Next.js in server components and we never need to refresh a session
        // from inside an auth check.
        setAll() {},
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fail closed: an unset allow-list must not mean "everyone is admin".
  const allowed = adminEmail();
  if (!allowed) {
    console.error("[auth] ADMIN_EMAIL/NEXT_PUBLIC_ADMIN_EMAIL is unset — refusing all writes");
    redirect("/");
  }
  if (user.email?.trim().toLowerCase() !== allowed) {
    console.warn(`[auth] rejected write from non-admin user: ${user.email ?? user.id}`);
    redirect("/");
  }

  return user;
}
