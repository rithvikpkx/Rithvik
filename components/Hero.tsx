"use client";
import { motion } from "motion/react";

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, filter: "blur(10px)", y: 18 },
  visible: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.65, ease: "easeOut" as const } },
};

export default function Hero() {
  return (
    <section className="hero" id="about">
      <div className="dot-grid" />

      <div className="hero-content">
        <motion.div variants={container} initial="hidden" animate="visible">
          <motion.h1 className="hero-title" variants={item}>
            Rithvik
            <br />
            <span className="gradient-text">Praveen Kumar</span>
          </motion.h1>

          <motion.div className="hero-sub" variants={item}>
            <p className="hero-tagline">
              CS + Math @{" "}
              <a
                href="https://www.cs.purdue.edu/"
                target="_blank"
                rel="noreferrer"
                className="purdue-link"
              >
                Purdue
              </a>
            </p>
            <p className="hero-sub-line">
              Building at the intersection of AI, systems, and real-world problems.
            </p>
          </motion.div>

          <motion.div className="hero-actions" variants={item}>
            <motion.a
              href="#projects"
              className="btn-shimmer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
              View Projects
            </motion.a>
            <motion.a
              href="#contact"
              className="btn-outline"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
            >
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
