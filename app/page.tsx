import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Bento from "@/components/Bento";
import Education from "@/components/Education";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import RagBot from "@/components/RagBot";
import SecondaryContextPanel from "@/components/SecondaryContextPanel";
import { serverClient } from "@/lib/supabase";
import type { GlobeMarker } from "@/lib/types";

function parseSafe<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export default async function Home() {
  const { data: rows } = await serverClient()
    .from("site_content")
    .select("key, value") as { data: { key: string; value: string }[] | null };

  const content = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));

  const bentoBuilding = parseSafe(content["bento.building"], undefined);
  const bentoStack    = parseSafe(content["bento.stack"], undefined);
  const bentoInterests = parseSafe(content["bento.interests"], undefined);
  const bentoGlobeMarkers = parseSafe<GlobeMarker[]>(content["bento.globe_markers"], []);

  return (
    <>
      <Nav />
      <main>
        <Hero
          subLine={content["hero.sub_line"]}
          tagLine={content["hero.tagline"]}
          nameLine1={content["hero.name.line1"]}
          nameLine2={content["hero.name.line2"]}
        />
        <Bento
          building={bentoBuilding}
          stack={bentoStack}
          interests={bentoInterests}
          markers={bentoGlobeMarkers}
        />
        <Education />
        <Projects />
        <Experience />
        <Contact
          headline={content["contact.headline"]}
          sub={content["contact.sub"]}
          githubUrl={content["contact.link.github"]}
          linkedinUrl={content["contact.link.linkedin"]}
          emailUrl={content["contact.link.email"]}
        />
      </main>
      <Footer />
      <SecondaryContextPanel />
      <RagBot />
    </>
  );
}
