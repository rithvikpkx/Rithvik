import "../../../(v7)/core.css"; // the real site's base tokens, so the designs and chrome look as they do in production
import SiteProvider from "@/components/site/SiteProvider";
import DesignProvider from "@/components/site/DesignProvider";
import ActiveDesign from "@/components/site/ActiveDesign";
import Overlays from "@/components/site/overlays/Overlays";
import ThemeStyleInjector from "@/components/ThemeStyleInjector";
import { BOOT_SCRIPT, designById, fontsHref, loadClassic } from "@/lib/designs/registry";
import { getLook, getPalettes } from "@/lib/designs/server";
import { fixture } from "@/lib/content/fixture";
import LabEdit from "./LabEdit";

/** Local harness: any look (`?theme=nimbus`, default Classic) rendered from the fixture, inside a stub EditModeContext, so inline
 *  editing, the admin bar and the login panel can be driven without signing in. `?bar=1` starts signed in, `?panel=1` opens the
 *  login panel. Not linked anywhere; the lab layout is noindex. Saves are stubbed (see LabEdit). */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const themes = await getPalettes();
  const look = await getLook(themes, sp.theme ?? null);
  const { default: Design } = await (designById(look)?.load() ?? loadClassic());
  const fonts = fontsHref(designById(look));
  return (
    <>
      {fonts && <link rel="stylesheet" href={fonts} />}
      <ThemeStyleInjector themes={themes} />
      <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      <SiteProvider content={fixture} overlays={null}>
        <LabEdit bar={sp.bar === "1"} panel={sp.panel === "1"}>
          <DesignProvider initial={look} palettes={themes}>
            <ActiveDesign initial={look}><Design content={fixture} /></ActiveDesign>
            <Overlays />
          </DesignProvider>
        </LabEdit>
      </SiteProvider>
    </>
  );
}
