"use client";
import { motion } from "motion/react";

/** Animated beam that traces down the timeline vertical line. */
export default function TimelineBeam() {
  return (
    <motion.div
      className="timeline-beam-glow"
      animate={{ top: ["-50%", "120%"] }}
      transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity }}
    />
  );
}
