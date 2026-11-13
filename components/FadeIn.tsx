"use client";
import { motion } from "motion/react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  /** Optional anchor, so callers can make a wrapped entry a scroll target. */
  id?: string;
}

/**
 * Wraps children in a motion.div that fades in with a blur when scrolled into view.
 * Replace every blur-fade + --delay pattern with this component.
 */
export default function FadeIn({ children, delay = 0, className, id }: FadeInProps) {
  return (
    <motion.div
      id={id}
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}
