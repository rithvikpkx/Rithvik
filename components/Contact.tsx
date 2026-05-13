import FadeIn from "./FadeIn";
import SocialDock from "./SocialDock";

export default function Contact() {
  return (
    <section className="contact-section" id="contact">
      <FadeIn className="contact-left">
        <p className="eyebrow">Contact</p>
        <h2>Let&apos;s connect.</h2>
        <p className="contact-sub">
          I&apos;m always interested in software engineering, AI, startups, research, and ambitious
          technical projects.
        </p>
      </FadeIn>

      <FadeIn delay={0.15} className="contact-dock-wrap">
        <SocialDock />
      </FadeIn>
    </section>
  );
}
