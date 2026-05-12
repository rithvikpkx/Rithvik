"use client";
import { useEffect } from "react";

/** Observes all .blur-fade elements and adds .visible when they enter the viewport. */
export default function SectionReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll(".blur-fade").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return null;
}
