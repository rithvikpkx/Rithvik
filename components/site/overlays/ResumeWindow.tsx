"use client";
import Window from "../windows/Window";
import { useSite } from "../SiteProvider";

// shortcut: no public/resume.pdf exists yet, so the Download button is off; Step 3 (Google Doc sync) flips this on.
const HAS_PDF = false;

/** The resume window: a paper-style summary built from site content (roles, education, stack). */
export default function ResumeWindow() {
  const { content: c, close } = useSite();
  const file = `${c.name.replace(/\s+/g, "-")}-Resume.pdf`;
  const e = c.education;
  return (
    <Window
      title={file} icon="file-text" label="Resume" className="resume-win" onClose={close}
      actions={HAS_PDF && <a className="ui-btn" href="/resume.pdf" download={file}>Download</a>}
    >
      <div className="pdf-viewport">
        <div className="pdf-page">
          <h1>{c.name.toUpperCase()}</h1>
          <p className="pc">{c.links.email} · {c.links.github.replace(/^https?:\/\//, "")} · rithvik.ai</p>
          <h2>Education</h2>
          <div className="pr"><span>{e.school}</span></div>
          <div className="pi"><span>{e.degree} · {e.focus}</span>{!e.grad.includes("{{") && <span>{e.grad}</span>}</div>
          <h2>Experience</h2>
          {c.experience.map((x) => (
            <div key={x.slug}>
              <div className="pr"><span>{x.org}</span><span>{x.where}</span></div>
              <div className="pi"><span>{x.role}</span><span>{x.when}</span></div>
              <ul>{x.desc.map((d) => <li key={d}>{d}</li>)}</ul>
            </div>
          ))}
          <h2>Projects</h2>
          {c.projects.slice(0, 4).map((p) => (
            <div key={p.slug}>
              <div className="pr"><span>{p.title}</span><span>{p.tags.slice(0, 4).join(", ")}</span></div>
              <ul><li>{p.desc[0]}</li></ul>
            </div>
          ))}
          <h2>Skills</h2>
          <p>{Object.entries(c.stack).slice(0, 2).map(([k, v], i) => <span key={k}>{i ? " · " : ""}<b>{k}:</b> {v.join(", ")}</span>)}</p>
        </div>
      </div>
      <p className="win-foot"><span>Summary of the site content</span></p>
    </Window>
  );
}
