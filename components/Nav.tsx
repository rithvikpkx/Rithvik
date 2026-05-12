"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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
    <header className={`nav-wrapper${hidden ? " hidden" : ""}`}>
      <nav className="nav">
        <Link href="#" className="nav-logo">R.</Link>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#projects">Projects</a>
          <a href="#experience">Experience</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>
    </header>
  );
}
