"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import EditableTagList from "./EditableTagList";
import BentoGlobeCard from "./BentoGlobeCard";
import { upsertSiteContent, updateGlobeMarkers } from "@/app/admin/actions";
import type { GlobeMarker } from "@/lib/types";

interface Building { title: string; description: string; tags: string[] }
interface GrowthItem { was: string; now: string }

const DEF_BUILDING: Building = {
  title: "Rithvik.ai",
  description: "A full-stack AI-powered personal platform with a RAG chatbot, live admin UI, and project dashboard. Built with Next.js, Supabase, and Claude.",
  tags: ["Next.js", "Supabase", "RAG", "Claude API"],
};
const GROWTH: GrowthItem[] = [
  { was: "Gave up easily", now: "Determination" },
  { was: "Unclear",        now: "Communication" },
  { was: "Slow to adapt",  now: "Quick Learner" },
];
const DEF_STACK = [
  "Python","TypeScript","JavaScript","React","Next.js","Node.js",
  "Supabase","AWS","Playwright","Vercel","Git","SQL","C","Java",
  "NumPy","Pandas","scikit-learn","OpenAI API",
];
const DEF_INTERESTS = [
  "Full-Stack Engineering","AI Systems","Applied ML",
  "Computer Systems","Startups","Research","Open Source",
];
const DEF_MARKERS: GlobeMarker[] = [];

interface Props {
  building?: Building;
  stack?: string[];
  interests?: string[];
  markers?: GlobeMarker[];
}

const grid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};
const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

export default function Bento({ building: bp, stack: skp, interests: ip, markers: mp }: Props) {
  const { isEditing } = useEditMode();
  const [bld, setBld]           = useState(bp ?? DEF_BUILDING);
  const [stack, setStack]       = useState(skp ?? DEF_STACK);
  const [interests, setInterests] = useState(ip ?? DEF_INTERESTS);
  const [markers, setMarkers]   = useState(mp ?? DEF_MARKERS);

  useEffect(() => {
    if (!isEditing) {
      setBld(bp ?? DEF_BUILDING);
      setStack(skp ?? DEF_STACK);
      setInterests(ip ?? DEF_INTERESTS);
      setMarkers(mp ?? DEF_MARKERS);
    }
  }, [bp, skp, ip, mp, isEditing]);

  const saveBld = async (patch: Partial<Building>) => {
    const u = { ...bld, ...patch };
    setBld(u);
    await upsertSiteContent("bento.building", JSON.stringify(u));
  };

  return (
    <section className="bento-section">
      <motion.div
        className="bento-grid"
        variants={grid}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.1 }}
      >

        {/* ── Location (Globe) ─────────────────────────────────────────── */}
        <BentoGlobeCard
          markers={markers}
          onSave={async (next) => {
            setMarkers(next);
            await updateGlobeMarkers(next);
          }}
        />

        {/* ── Currently Building ──────────────────────────────────────── */}
        <motion.div className="bento-card bento-building" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">Currently Building</p>
          <EditableText
            tag="h3" className="card-title" value={bld.title}
            onSave={(v) => saveBld({ title: v })}
          />
          <EditableText
            tag="p" className="card-sub" value={bld.description}
            onSave={(v) => saveBld({ description: v })} multiline
          />
          {isEditing ? (
            <EditableTagList tags={bld.tags} onSave={(tags) => saveBld({ tags })} className="building-tags" />
          ) : (
            <div className="building-tags">
              {bld.tags.map((t) => <span key={t}>{t}</span>)}
            </div>
          )}
        </motion.div>

        {/* ── Growth ──────────────────────────────────────────────────── */}
        <motion.div className="bento-card bento-growth" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">Growth</p>
          <p className="growth-subline">Previous weaknesses that grew into my 3 greatest strengths.</p>
          <ul className="growth-list">
            {GROWTH.map((g) => (
              <li key={g.now} className="growth-item">
                <span className="growth-was">{g.was}</span>
                <span className="growth-arrow" aria-hidden="true">→</span>
                <span className="growth-is">{g.now}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* ── Stack ───────────────────────────────────────────────────── */}
        <motion.div className="bento-card bento-marquee" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">Stack</p>
          {isEditing ? (
            <EditableTagList
              tags={stack}
              onSave={async (tags) => { setStack(tags); await upsertSiteContent("bento.stack", JSON.stringify(tags)); }}
              className="bento-stack-edit"
            />
          ) : (
            <div className="marquee-wrapper">
              <div className="marquee-track">
                {[...stack, ...stack].map((item, i) => <span key={i}>{item}</span>)}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Interests ───────────────────────────────────────────────── */}
        <motion.div className="bento-card bento-interests" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">Interests</p>
          {isEditing ? (
            <EditableTagList
              tags={interests}
              onSave={async (tags) => { setInterests(tags); await upsertSiteContent("bento.interests", JSON.stringify(tags)); }}
              className="interests-list"
            />
          ) : (
            <div className="interests-list">
              {interests.map((i) => <span key={i}>{i}</span>)}
            </div>
          )}
        </motion.div>

      </motion.div>
    </section>
  );
}
