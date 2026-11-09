"use client";
import FlickeringGrid from "./FlickeringGrid";
import { KineticText } from "./KineticText";
import EditableText from "./EditableText";
import HeroConnect from "./HeroConnect";
import { useEditMode } from "./EditModeProvider";
import { useTheme } from "./ThemeProvider";
import { upsertSiteContent } from "@/app/admin/actions";

const DEFAULT_SUB_LINE  = "Building at the intersection of AI, systems, and real-world problems.";
const DEFAULT_TAGLINE   = "CS + Math @ Purdue";
const DEFAULT_NAME_1    = "Rithvik";
const DEFAULT_NAME_2    = "Praveen Kumar";
const DEFAULT_GITHUB    = "https://github.com/rithvikpkx";
const DEFAULT_LINKEDIN  = "#";
const DEFAULT_EMAIL     = "mailto:rithvikpkx@gmail.com";

// Picks a flickering-grid particle color that contrasts with a hex background.
// Derived per-theme so every light theme gets dark particles, not just rithvik-light.
function gridColorForBg(bgHex: string): string {
  const hex = bgHex.replace("#", "").trim();
  if (hex.length < 6) return "#ffffff";
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#0e0b0a" : "#ffffff";
}

// Entrance is CSS-driven (.hero-enter / .hero-connect-col in globals.css) so the SSR
// HTML is visible without JS. The connect cluster never translates: a `y` shift would
// leave the ref-measured beams (HeroConnect) stale.

interface Props {
  subLine?:     string;
  tagLine?:     string;
  nameLine1?:   string;
  nameLine2?:   string;
  githubUrl?:   string;
  linkedinUrl?: string;
  emailUrl?:    string;
}

export default function Hero({
  subLine     = DEFAULT_SUB_LINE,
  tagLine     = DEFAULT_TAGLINE,
  nameLine1   = DEFAULT_NAME_1,
  nameLine2   = DEFAULT_NAME_2,
  githubUrl   = DEFAULT_GITHUB,
  linkedinUrl = DEFAULT_LINKEDIN,
  emailUrl    = DEFAULT_EMAIL,
}: Props) {
  const { isEditing } = useEditMode();
  const { themes, currentSlug } = useTheme();

  // Theme-aware particle color — white particles vanish on any light theme,
  // so derive contrast from the active theme's background luminance.
  const currentBg = themes.find((t) => t.slug === currentSlug)?.tokens.bg ?? "#0e0b0a";
  const gridColor = gridColorForBg(currentBg);

  // Keep the Purdue link in view mode by splitting on "Purdue"
  const tagParts = tagLine.split("Purdue");
  const hasPurdue = tagParts.length > 1;

  // Wrap onSave with a browser confirm so accidental name changes don't go live silently
  const saveNameWithConfirm = (key: string) => async (value: string) => {
    if (!window.confirm(`Update the name on your site to "${value}"?`)) throw new Error("cancelled");
    await upsertSiteContent(key, value);
  };

  return (
    <section className="hero" id="about">
      <FlickeringGrid className="hero-flickering-grid" color={gridColor} squareSize={4} gridGap={6} maxOpacity={0.1} flickerChance={0.08} />

      <div className="hero-content">
        <div className="hero-text">

          {/* Name */}
          <h1 className="hero-title">
            {isEditing ? (
              <>
                <EditableText tag="span" className="hero-title-line"
                  value={nameLine1} onSave={saveNameWithConfirm("hero.name.line1")} />
                <EditableText tag="span" className="hero-title-line gradient-text"
                  value={nameLine2} onSave={saveNameWithConfirm("hero.name.line2")} />
              </>
            ) : (
              <>
                <KineticText text={nameLine1} as="span" />
                <KineticText text={nameLine2} as="span" className="gradient-text" />
              </>
            )}
          </h1>

          <div className="hero-sub hero-enter">
            {/* Tagline */}
            {isEditing ? (
              <EditableText tag="p" className="hero-tagline" value={tagLine}
                onSave={(v) => upsertSiteContent("hero.tagline", v)}
                placeholder="Tagline…" />
            ) : (
              <p className="hero-tagline">
                {hasPurdue ? tagParts[0] : tagLine}
                {hasPurdue && (
                  <a href="https://www.cs.purdue.edu/" target="_blank" rel="noreferrer" className="purdue-link">
                    Purdue
                  </a>
                )}
                {hasPurdue && tagParts[1]}
              </p>
            )}

            {/* Sub-line (already editable since Stage 2) */}
            <EditableText tag="p" className="hero-sub-line" value={subLine}
              onSave={(v) => upsertSiteContent("hero.sub_line", v)}
              placeholder="Enter a sub-headline…" />
          </div>

        </div>

        <div className="hero-connect-col">
          <HeroConnect githubUrl={githubUrl} linkedinUrl={linkedinUrl} emailUrl={emailUrl} />
        </div>
      </div>
    </section>
  );
}
