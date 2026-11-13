import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/** Browser client — must be createBrowserClient (cookies) so server actions can read the session. */
export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
