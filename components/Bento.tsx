"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import EditableTagList from "./EditableTagList";
import LocalTime from "./LocalTime";
import { upsertSiteContent } from "@/app/admin/actions";
import type { GlobeMarker } from "@/lib/types";

interface Building { title: string; description: string; tags: string[] }
interface Stat { num: string; label: string }

const DEF_LOCATION = "West Lafayette, IN";
const DEF_BUILDING: Building = {
  title: "Rithvik.ai",
  description: "A full-stack AI-powered personal platform with a RAG chatbot, live admin UI, and project dashboard. Built with Next.js, Supabase, and Claude.",
  tags: ["Next.js", "Supabase", "RAG", "Claude API"],
};
const DEF_STATS: Stat[] = [
  { num: "4+", label: "Projects" },
  { num: "2+", label: "Years coding" },
  { num: "6+", label: "Languages" },
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
  location?: string;
  building?: Building;
  stats?: Stat[];
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

export default function Bento({ location: lp, building: bp, stats: sp, stack: skp, interests: ip, markers: mp }: Props) {
  const { isEditing } = useEditMode();
  const [loc, setLoc]           = useState(lp ?? DEF_LOCATION);
  const [bld, setBld]           = useState(bp ?? DEF_BUILDING);
  const [stats, setStats]       = useState(sp ?? DEF_STATS);
  const [stack, setStack]       = useState(skp ?? DEF_STACK);
  const [interests, setInterests] = useState(ip ?? DEF_INTERESTS);
  const [_markers, _setMarkers] = useState(mp ?? DEF_MARKERS);

  useEffect(() => {
    if (!isEditing) {
      setLoc(lp ?? DEF_LOCATION);
      setBld(bp ?? DEF_BUILDING);
      setStats(sp ?? DEF_STATS);
      setStack(skp ?? DEF_STACK);
      setInterests(ip ?? DEF_INTERESTS);
      _setMarkers(mp ?? DEF_MARKERS);
    }
  }, [lp, bp, sp, skp, ip, mp, isEditing]);

  const saveBld = async (patch: Partial<Building>) => {
    const u = { ...bld, ...patch };
    setBld(u);
    await upsertSiteContent("bento.building", JSON.stringify(u));
  };

  const saveStat = async (i: number, patch: Partial<Stat>) => {
    const u = stats.map((s, j) => j === i ? { ...s, ...patch } : s);
    setStats(u);
    await upsertSiteContent("bento.stats", JSON.stringify(u));
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

        {/* ── Location ────────────────────────────────────────────────── */}
        <motion.div className="bento-card bento-location" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">Location</p>
          <EditableText
            tag="h3" className="card-title" value={loc}
            onSave={async (v) => { setLoc(v); await upsertSiteContent("bento.location", v); }}
          />
          <p className="card-sub">Purdue University</p>
          <LocalTime />
        </motion.div>

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

        {/* ── Stats ───────────────────────────────────────────────────── */}
        <motion.div className="bento-card bento-stats" variants={card} whileHover={{ y: -3, transition: { duration: 0.2 } }}>
          <p className="card-eyebrow">By the numbers</p>
          <div className="stats-grid">
            {stats.map(({ num, label }, i) => (
              <div className="stat" key={i}>
                <EditableText
                  tag="span" className="stat-num" value={num}
                  onSave={(v) => saveStat(i, { num: v })}
                />
                <EditableText
                  tag="span" className="stat-label" value={label}
                  onSave={(v) => saveStat(i, { label: v })}
                />
              </div>
            ))}
          </div>
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
