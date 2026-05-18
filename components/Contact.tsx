"use client";
import { useEffect, useRef, useState } from "react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import FadeIn from "./FadeIn";
import { GithubIcon, LinkedinIcon, EmailIcon } from "./SocialIcons";
import { upsertSiteContent } from "@/app/admin/actions";

const DEFAULT_HEADLINE = "Let’s connect.";
const DEFAULT_SUB = "I’m always interested in software engineering, AI, startups, research, and ambitious technical projects.";

interface Props {
  headline?: string;
  sub?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  emailUrl?: string;
}

export default function Contact({
  headline: h = DEFAULT_HEADLINE,
  sub: s = DEFAULT_SUB,
  githubUrl: g = "https://github.com/rithvikpkx",
  linkedinUrl: li = "#",
  emailUrl: em = "mailto:rithvikpkx@gmail.com",
}: Props) {
  const { isEditing } = useEditMode();
  const [headline, setHeadline]     = useState(h);
  const [sub, setSub]               = useState(s);
  const [githubUrl, setGithubUrl]   = useState(g);
  const [linkedinUrl, setLinkedinUrl] = useState(li);
  const [emailUrl, setEmailUrl]     = useState(em);
  const [copied, setCopied]         = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setHeadline(h); setSub(s);
      setGithubUrl(g); setLinkedinUrl(li); setEmailUrl(em);
    }
  }, [h, s, g, li, em, isEditing]);

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  // Copies the bare email address (mailto: prefix stripped) and flashes a confirmation.
  const copyEmail = async () => {
    const address = emailUrl.replace(/^mailto:/i, "").trim();
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      return; // clipboard unavailable (insecure context / denied) — fail silently
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  const links = [
    { href: githubUrl,   label: "GitHub",   Icon: GithubIcon,   key: "contact.link.github",   setter: setGithubUrl,   isCopy: false },
    { href: linkedinUrl, label: "LinkedIn", Icon: LinkedinIcon, key: "contact.link.linkedin", setter: setLinkedinUrl, isCopy: false },
    { href: emailUrl,    label: "Email",    Icon: EmailIcon,    key: "contact.link.email",    setter: setEmailUrl,    isCopy: true  },
  ];

  return (
    <section className="contact-section" id="contact">
      <FadeIn className="contact-left">
        <p className="eyebrow">Contact</p>
        <EditableText
          tag="h2" value={headline}
          onSave={async (v) => { setHeadline(v); await upsertSiteContent("contact.headline", v); }}
        />
        <EditableText
          tag="p" className="contact-sub" value={sub} multiline
          onSave={async (v) => { setSub(v); await upsertSiteContent("contact.sub", v); }}
        />
      </FadeIn>

      <FadeIn delay={0.15} className="contact-links">
        {links.map(({ href, label, Icon, key, setter, isCopy }, i) => (
          <div
            key={label}
            className={"contact-link-wrap" + (isEditing ? " contact-link-editing" : "")}
            style={{ "--pulse-delay": `${i * 0.55}s` } as React.CSSProperties}
          >
            {isCopy ? (
              <button type="button" onClick={copyEmail} className="contact-link" aria-label="Copy email address">
                <Icon />
                {label}
              </button>
            ) : (
              <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className="contact-link"
              >
                <Icon />
                {label}
              </a>
            )}
            {isCopy && copied && (
              <span className="contact-copied" role="status">Copied to clipboard</span>
            )}
            {isEditing && (
              <EditableText
                tag="span" className="contact-edit-url" value={href}
                onSave={async (v) => { setter(v); await upsertSiteContent(key, v); }}
                placeholder="URL…"
              />
            )}
          </div>
        ))}
      </FadeIn>
    </section>
  );
}
