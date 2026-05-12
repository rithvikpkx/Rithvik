import FadeIn from "./FadeIn";

const projects = [
  {
    badge: "In Progress",
    title: "Rithvik.ai Portfolio",
    desc: "Personal portfolio website being built from the ground up — starting with static HTML/CSS and evolving into a full-stack AI-powered platform with a RAG chatbot and live admin UI.",
    tags: ["HTML", "CSS", "Next.js", "Supabase", "RAG"],
    delay: 0.05,
  },
  {
    badge: "Browser Monitor",
    title: "WatchDawg",
    desc: "Cloud-running browser monitor that checks dynamic webpages, compares values against a baseline, and sends notifications when changes are detected.",
    tags: ["TypeScript", "Playwright", "Automation"],
    delay: 0.15,
  },
  {
    badge: "Full Stack",
    title: "BoilerFrame",
    desc: "Web app that uses AWS Rekognition to identify where a target person appears in uploaded video content.",
    tags: ["JavaScript", "AWS", "Computer Vision"],
    delay: 0.25,
  },
  {
    badge: "AI Education",
    title: "Pratigya Learning Platform",
    desc: "AI-powered learning platform for rural learners, including lessons, quizzes, assignments, and a context-aware chatbot grounded in course content.",
    tags: ["RAG", "Full Stack", "Education"],
    delay: 0.35,
  },
];

export default function Projects() {
  return (
    <section className="projects-section" id="projects">
      <FadeIn>
        <div className="section-header">
          <p className="eyebrow">Projects</p>
          <h2>Selected work.</h2>
        </div>
      </FadeIn>
      <div className="projects-grid">
        {projects.map(({ badge, title, desc, tags, delay }) => (
          <FadeIn key={title} delay={delay} className="project-card">
            <div className="project-header">
              <span className="project-badge">{badge}</span>
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
            <div className="project-tags">
              {tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
