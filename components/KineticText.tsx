"use client";
import { motion } from "motion/react";

interface Props {
  text: string;
  className?: string;
  startDelay?: number; // delay before the first character animates
  stagger?: number;    // delay between each character
}

/** Splits text into characters and animates each with spring physics. */
export default function KineticText({ text, className, startDelay = 0, stagger = 0.038 }: Props) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((char, i) => (
        <motion.span
          key={i}
          style={{ display: char === " " ? "inline" : "inline-block" }}
          initial={{ opacity: 0, y: 48, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0,  filter: "blur(0px)" }}
          transition={{
            delay: startDelay + i * stagger,
            type: "spring",
            stiffness: 240,
            damping: 22,
            mass: 0.8,
          }}
        >
          {char === " " ? " " : char}
        </motion.span>
      ))}
    </span>
  );
}
