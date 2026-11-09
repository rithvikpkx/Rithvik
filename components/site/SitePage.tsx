import SiteProvider from "@/components/site/SiteProvider";
import DesignProvider from "@/components/site/DesignProvider";
import ActiveDesign from "@/components/site/ActiveDesign";
import DesignDial from "@/components/site/DesignDial";
import { getContent } from "@/lib/content";
import { designById, loadClassic } from "@/lib/designs/registry";
import { getLook, getPalettes } from "@/lib/designs/server";

/** The whole v7 site for one request: active design (from `?theme=` or the cookie) rendered
 *  from content, plus the dial. `children` render inside the providers (e.g. a deep-linked case). */
export default async function SitePage({ theme, children }: { theme?: string | null; children?: React.ReactNode }) {
  const [content, themes] = await Promise.all([getContent(), getPalettes()]);
  const look = await getLook(themes, theme ?? null);
  const { default: Design } = await (designById(look)?.load() ?? loadClassic());

  return (
    <SiteProvider content={content}>
      <DesignProvider initial={look} palettes={themes}>
        <ActiveDesign initial={look}>
          <Design content={content} />
        </ActiveDesign>
        <DesignDial />
        {children}
      </DesignProvider>
    </SiteProvider>
  );
}
