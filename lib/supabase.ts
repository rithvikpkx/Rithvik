import { createClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser client — uses cookies so server actions can read the session. */
export const supabase = createBrowserClient<Database>(url, anon);

/** Server client — uses service role key, only call from server components / actions. */
export function serverClient() {
  return createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}

/** Untyped service role client for admin write operations. */
export function adminClient() {
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
