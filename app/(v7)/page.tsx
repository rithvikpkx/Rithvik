import SitePage from "@/components/site/SitePage";

/** The homepage: the active design (cookie or `?theme=`) rendered from DB content. Per-request because
 *  of the design cookie; the content and palette reads underneath are cached 60s. */
export default async function Home({ searchParams }: { searchParams: Promise<{ theme?: string | string[] }> }) {
  const { theme } = await searchParams;
  return <SitePage theme={typeof theme === "string" ? theme : null} />;
}
