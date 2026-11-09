import type { Metadata } from "next";
import SiteProvider from "@/components/site/SiteProvider";
import DesignProvider from "@/components/site/DesignProvider";
import ActiveDesign from "@/components/site/ActiveDesign";
import DesignDial from "@/components/site/DesignDial";
import { getContent } from "@/lib/content";
import { designById, loadClassic } from "@/lib/designs/registry";
import { getLook, getPalettes } from "@/lib/designs/server";

// Mirrors the homepage. The design cookie still makes this route per-request; the data reads
// underneath are what get cached (getPalettes, 60s).
export const revalidate = 60;

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** v7 preview: the active design (from `?theme=` or the cookie) rendered from content. */
export default async function Preview({ searchParams }: { searchParams: Promise<{ theme?: string | string[] }> }) {
  const [content, themes, { theme }] = await Promise.all([getContent(), getPalettes(), searchParams]);
  const look = await getLook(themes, typeof theme === "string" ? theme : null);
  const { default: Design } = await (designById(look)?.load() ?? loadClassic());

  return (
    <SiteProvider content={content}>
      <DesignProvider initial={look} palettes={themes}>
        <ActiveDesign initial={look}>
          <Design content={content} />
        </ActiveDesign>
        <DesignDial />
      </DesignProvider>
    </SiteProvider>
  );
}
