import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Bento from "@/components/Bento";
import Education from "@/components/Education";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import RagBot from "@/components/RagBot";
import SectionReveal from "@/components/SectionReveal";

export default function Home() {
  return (
    <>
      <SectionReveal />
      <Nav />
      <main>
        <Hero />
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
