"use client";

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

export default function BentoGlobeCard({ markers, onSave }: Props) {
  const { isEditing } = useEditMode();
  return (
    <motion.div
      className="bento-card bento-location bento-globe"
      variants={card}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Globe markers={markers} />
      {isEditing && <MarkerEditorPanel markers={markers} onSave={onSave} />}
    </motion.div>
  );
}
