import { serverClient } from "@/lib/supabase";
import type {
  Project,
  Experience as ExperienceRow,
  Education as EducationRow,
  GlobeMarker,
} from "@/lib/types";

// Match the homepage ISR cadence so content stays in sync.
export const revalidate = 60;

interface Building { title: string; description: string; tags: string[] }

function parseSafe<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

// Descriptions are stored one bullet per line (see DescriptionBlock).
function bullets(desc: string): string[] {
  return (desc ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
}

function Body({ desc }: { desc: string }) {
  const lines = bullets(desc);
  if (lines.length > 1) return <ul>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>;
  if (lines.length === 1) return <p>{lines[0]}</p>;
  return null;
}

export default async function Buffett() {
  const sb = serverClient();
  const [contentRes, eduRes, projRes, expRes] = await Promise.all([
    sb.from("site_content").select("key, value"),
    sb.from("education").select("*").order("sort_order"),
    sb.from("projects").select("*").order("sort_order"),
    sb.from("experience").select("*").order("sort_order"),
  ]);

  const content = Object.fromEntries(
    ((contentRes.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]),
  );
  const education = ((eduRes.data ?? []) as EducationRow[]).filter((e) => e.published);
  const projects = ((projRes.data ?? []) as Project[]).filter((p) => p.published);
  const experience = (expRes.data ?? []) as ExperienceRow[];

  const name =
    [content["hero.name.line1"], content["hero.name.line2"]].filter(Boolean).join(" ") ||
    "Rithvik Praveen Kumar";
  const tagline = content["hero.tagline"] ?? "";
  const subLine = content["hero.sub_line"] ?? "";
  const building = parseSafe<Building | undefined>(content["bento.building"], undefined);
  const stack = parseSafe<string[]>(content["bento.stack"], []);
  const interests = parseSafe<string[]>(content["bento.interests"], []);
  const markers = parseSafe<GlobeMarker[]>(content["bento.globe_markers"], []);
  const current = markers.find((m) => m.kind === "current") ?? markers.find((m) => m.kind === "home");
  const location = current
    ? [current.city, current.region, current.country].filter(Boolean).join(", ")
    : "";

  const github = content["contact.link.github"];
  const linkedin = content["contact.link.linkedin"];
  const email = content["contact.link.email"];
  const contactHeadline = content["contact.headline"] ?? "";
  const contactSub = content["contact.sub"] ?? "";

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional full-nav across root-layout boundary */}
      <p className="return"><a href="/">&larr; Return to the full site</a></p>

      <header className="bh-header">
        <h1>{name}</h1>
        {tagline ? <p className="addr">{tagline}</p> : null}
        {location ? <p className="addr">{location}</p> : null}
        <p className="addr">Personal Home Page</p>
      </header>

      <hr />

      <nav className="index" aria-label="Sections">
        <ul>
          <li><a href="#about">About / A Message</a></li>
          <li><a href="#education">Education</a></li>
          <li><a href="#projects">Projects</a></li>
        </ul>
        <ul>
          <li><a href="#experience">Experience</a></li>
          <li><a href="#contact">Contact</a></li>
          {github ? <li><a href={github}>GitHub</a></li> : null}
          {linkedin ? <li><a href={linkedin}>LinkedIn</a></li> : null}
          {email ? <li><a href={`mailto:${email}`}>Email</a></li> : null}
        </ul>
      </nav>

      <hr />

      <section id="about">
        <h2>About</h2>
        {tagline ? <p>{tagline}</p> : null}
        {subLine ? <p>{subLine}</p> : null}
        {building ? (<><h3>{building.title}</h3><p>{building.description}</p></>) : null}
        {stack.length ? <p><strong>Stack:</strong> {stack.join(", ")}</p> : null}
        {interests.length ? <p><strong>Interests:</strong> {interests.join(", ")}</p> : null}
      </section>

      <hr />

      <section id="education">
        <h2>Education</h2>
        {education.map((e) => (
          <div key={e.id} className="entry">
            <h3>{e.school_url ? <a href={e.school_url}>{e.school}</a> : e.school}</h3>
            <p>{e.degree}</p>
            {e.concentrations?.length ? <p>Concentrations: {e.concentrations.join(", ")}</p> : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="projects">
        <h2>Projects</h2>
        {projects.map((p) => (
          <div key={p.id} className="entry">
            <h3>{p.title}{p.badge ? ` — ${p.badge}` : ""}</h3>
            <Body desc={p.description} />
            {p.tags?.length ? <p className="tags">{p.tags.join(" · ")}</p> : null}
            {Object.keys(p.links ?? {}).length ? (
              <p>{Object.entries(p.links).map(([k, v], i) => (
                <span key={k}>{i > 0 ? " · " : ""}<a href={v}>{k}</a></span>
              ))}</p>
            ) : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="experience">
        <h2>Experience</h2>
        {experience.map((x) => (
          <div key={x.id} className="entry">
            <h3>{x.role}{x.org ? <> — {x.org_url ? <a href={x.org_url}>{x.org}</a> : x.org}</> : null}</h3>
            <p className="meta">{[x.date_range, x.location].filter(Boolean).join(" · ")}</p>
            <Body desc={x.description} />
            {x.tags?.length ? <p className="tags">{x.tags.join(" · ")}</p> : null}
          </div>
        ))}
      </section>

      <hr />

      <section id="contact">
        <h2>Contact</h2>
        {contactHeadline ? <p>{contactHeadline}</p> : null}
        {contactSub ? <p>{contactSub}</p> : null}
        <ul>
          {github ? <li><a href={github}>GitHub</a></li> : null}
          {linkedin ? <li><a href={linkedin}>LinkedIn</a></li> : null}
          {email ? <li><a href={`mailto:${email}`}>{email}</a></li> : null}
        </ul>
      </section>

      <hr />

      <footer className="bh-footer">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- intentional full-nav across root-layout boundary */}
        <p><a href="/">&larr; Return to the full experience</a></p>
        <p>Copyright &copy; {new Date().getFullYear()} {name}.</p>
        <p className="note">Inspired by the official Berkshire Hathaway website.</p>
      </footer>
    </>
  );
}
