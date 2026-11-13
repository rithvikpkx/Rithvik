"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { GlobeMarker } from "@/lib/types";
import { useEditMode } from "./EditModeProvider";
import { Globe } from "./Globe";
import MarkerEditorPanel from "./MarkerEditorPanel";

interface Props {
  markers: GlobeMarker[];
  onSave: (next: GlobeMarker[]) => Promise<void>;
}

const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

// Tracks the 860px breakpoint so the globe card can opt out of scroll-triggered reveal on phones.
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

export default function BentoGlobeCard({ markers, onSave }: Props) {
  const { isEditing } = useEditMode();
  const isMobile = useIsMobile();
  return (
    <motion.div
      className="bento-card bento-location bento-globe"
      variants={card}
      // On phones the grid only peeks in, so its whileInView never fires at landing —
      // animate this first card in on mount instead. Desktop keeps inheriting the grid stagger.
      initial={isMobile ? "hidden" : undefined}
      animate={isMobile ? "visible" : undefined}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Globe markers={markers} />
      {isEditing && <MarkerEditorPanel markers={markers} onSave={onSave} />}
    </motion.div>
  );
}
