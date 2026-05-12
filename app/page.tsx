import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Bento from "@/components/Bento";
import Education from "@/components/Education";
import Projects from "@/components/Projects";
import Experience from "@/components/Experience";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";
import RagBot from "@/components/RagBot";

export default function Home() {
  return (
    <>
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
