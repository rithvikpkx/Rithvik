import type { Metadata } from "next";
import SitePage from "@/components/site/SitePage";

// The design cookie makes this route per-request; the data reads underneath are cached 60s.
export const revalidate = 60;

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** v7 preview of the whole site (becomes `/` at the switch-over). */
export default async function Preview({ searchParams }: { searchParams: Promise<{ theme?: string | string[] }> }) {
  const { theme } = await searchParams;
  return <SitePage theme={typeof theme === "string" ? theme : null} />;
}
