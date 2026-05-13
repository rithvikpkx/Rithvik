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

export default async function Home() {
  const { data: rows } = await serverClient()
    .from("site_content")
    .select("key, value") as { data: { key: string; value: string }[] | null };

  // Build a lookup map; components fall back to hardcoded defaults if key absent
  const content = Object.fromEntries((rows ?? []).map((r) => [r.key, r.value]));

  return (
    <>
      <Nav />
      <main>
        <Hero subLine={content["hero.sub_line"]} />
        <Bento />
        <Education />
        <Projects />
        <Experience />
        <Contact />
      </main>
      <Footer />
      <RagBot />
    </>
  );
}
