"use client";

import { motion } from "motion/react";
import type { GlobeMarker } from "@/lib/types";
import { Globe } from "./Globe";

interface Props {
  markers: GlobeMarker[];
}

const card = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 20 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

/** Bento tile that hosts the interactive globe. View-only for now; Task 11
 *  layers in the edit-mode marker editor. */
export default function BentoGlobeCard({ markers }: Props) {
  return (
    <motion.div
      className="bento-card bento-location bento-globe"
      variants={card}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Globe markers={markers} />
    </motion.div>
  );
}
