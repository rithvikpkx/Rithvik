"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";

export default function Nav() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY && y > 80);
      lastY = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      className="nav-wrapper"
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
    >
      <nav className="nav" aria-label="Main navigation">
        <Link href="#" className="nav-logo" aria-label="Rithvik Praveen Kumar — home">R.</Link>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#experience">Experience</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-admin-wrap">
          <a href="/admin/login" className="nav-admin-btn">I am Rithvik</a>
          <span className="nav-admin-tooltip">
            <span className="nav-admin-tooltip-title">Live content editor</span>
            Add, edit, or remove projects and experience entries directly on the site — changes go live instantly, no code required.
          </span>
        </div>
      </nav>
    </motion.header>
  );
}
