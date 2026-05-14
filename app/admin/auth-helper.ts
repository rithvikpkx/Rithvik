import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** Verifies an active session exists, redirects to / if not. Used by every
 *  server action in this directory. Lives in its own module so it can be
 *  imported from both actions.ts and rag-actions.ts without circular deps. */
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
  return user;
}
