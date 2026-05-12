import LocalTime from "./LocalTime";
import FadeIn from "./FadeIn";

const stack = [
  "Python","TypeScript","JavaScript","React","Next.js","Node.js",
  "Supabase","AWS","Playwright","Vercel","Git","SQL","C","Java",
  "NumPy","Pandas","scikit-learn","OpenAI API",
];

export default function Bento() {
  return (
    <section className="bento-section">
      <div className="bento-grid">

        <FadeIn delay={0.05} className="bento-card bento-location">
          <p className="card-eyebrow">Location</p>
          <h3 className="card-title">West Lafayette, IN</h3>
          <p className="card-sub">Purdue University</p>
          <LocalTime />
        </FadeIn>

        <FadeIn delay={0.15} className="bento-card bento-building">
          <p className="card-eyebrow">Currently Building</p>
          <h3 className="card-title">Rithvik.ai</h3>
          <p className="card-sub">
            A full-stack AI-powered personal platform with a RAG chatbot, live admin UI, and
            project dashboard. Built with Next.js, Supabase, and Claude.
          </p>
          <div className="building-tags">
            {["Next.js", "Supabase", "RAG", "Claude API"].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.25} className="bento-card bento-stats">
          <p className="card-eyebrow">By the numbers</p>
          <div className="stats-grid">
            {[
              { num: "4+", label: "Projects" },
              { num: "2+", label: "Years coding" },
              { num: "6+", label: "Languages" },
            ].map(({ num, label }) => (
              <div className="stat" key={label}>
                <span className="stat-num">{num}</span>
                <span className="stat-label">{label}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={0.35} className="bento-card bento-marquee">
          <p className="card-eyebrow">Stack</p>
          <div className="marquee-wrapper">
            <div className="marquee-track">
              {[...stack, ...stack].map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.45} className="bento-card bento-interests">
          <p className="card-eyebrow">Interests</p>
          <div className="interests-list">
            {[
              "Full-Stack Engineering","AI Systems","Applied ML",
              "Computer Systems","Startups","Research","Open Source",
            ].map((i) => (
              <span key={i}>{i}</span>
            ))}
          </div>
        </FadeIn>

      </div>
    </section>
  );
}
