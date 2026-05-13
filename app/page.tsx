import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Bento from "@/components/Bento";
import Education from "@/components/Education";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import RagBot from "@/components/RagBot";
import { serverClient } from "@/lib/supabase";

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
  const bentoStats    = parseSafe(content["bento.stats"], undefined);
  const bentoStack    = parseSafe(content["bento.stack"], undefined);
  const bentoInterests = parseSafe(content["bento.interests"], undefined);

  return (
    <>
      <Nav />
      <main>
        <Hero subLine={content["hero.sub_line"]} />
        <Bento
          location={content["bento.location"]}
          building={bentoBuilding}
          stats={bentoStats}
          stack={bentoStack}
          interests={bentoInterests}
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
      <RagBot />
    </>
  );
}
