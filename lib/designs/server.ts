import "server-only";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { serverClient } from "@/lib/supabase-server";
import { DEFAULT_THEME_SLUG, FALLBACK_THEMES } from "@/lib/themes";
import type { Theme } from "@/lib/types";
import { DESIGN_KEY, resolveLook } from "./registry";

/** Published palette rows (same data ThemeProvider uses), cached 60s. Reading the design cookie
 *  makes v7 pages per-request, so this cache is what keeps Supabase off the hot path. */
export const getPalettes = unstable_cache(
  async (): Promise<Theme[]> => {
    const { data } = await serverClient().from("themes").select("*").order("sort_order");
    const themes = ((data ?? []) as Theme[]).filter((t) => t.published);
    return themes.length > 0 ? themes : FALLBACK_THEMES;
  },
  ["v7-palettes"],
  { revalidate: 60 },
);

/** The look to server-render: a `?theme=` deep link, else the cookie, else GitHub Light (Classic). */
export async function getLook(themes: Theme[], requested?: string | null): Promise<string> {
  const slugs = themes.map((t) => t.slug);
  return resolveLook(requested, slugs) ?? resolveLook((await cookies()).get(DESIGN_KEY)?.value, slugs) ?? DEFAULT_THEME_SLUG;
}
