"use client";
import { motion } from "motion/react";
import FlickeringGrid from "./FlickeringGrid";
import { KineticText } from "./KineticText";
import EditableText from "./EditableText";
import { useEditMode } from "./EditModeProvider";
import { upsertSiteContent } from "@/app/admin/actions";

const DEFAULT_SUB_LINE  = "Building at the intersection of AI, systems, and real-world problems.";
const DEFAULT_TAGLINE   = "CS + Math @ Purdue";
const DEFAULT_NAME_1    = "Rithvik";
const DEFAULT_NAME_2    = "Praveen Kumar";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};
const item = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 18 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.65, ease: "easeOut" as const } },
};

interface Props {
  subLine?:   string;
  tagLine?:   string;
  nameLine1?: string;
  nameLine2?: string;
}

export default function Hero({
  subLine   = DEFAULT_SUB_LINE,
  tagLine   = DEFAULT_TAGLINE,
  nameLine1 = DEFAULT_NAME_1,
  nameLine2 = DEFAULT_NAME_2,
}: Props) {
  const { isEditing } = useEditMode();

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
      <FlickeringGrid className="hero-flickering-grid" color="#ffffff" squareSize={4} gridGap={6} maxOpacity={0.1} flickerChance={0.08} />

      <div className="hero-content">
        <motion.div variants={container} initial="hidden" animate="visible">

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

          <motion.div className="hero-sub" variants={item}>
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
          </motion.div>

          <motion.div className="hero-actions" variants={item}>
            <motion.a href="#projects" className="btn-shimmer" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              View Projects
            </motion.a>
            <motion.a href="#contact" className="btn-outline" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              Get in Touch
            </motion.a>
          </motion.div>

        </motion.div>
      </div>

      <div className="scroll-indicator">
        <span />
      </div>
    </section>
  );
}
