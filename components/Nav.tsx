"use client";
import { Fragment, useEffect, useState } from "react";
import { motion } from "motion/react";

type Section = "home" | "projects" | "experience" | "contact";

const NAV_ITEMS: { label: string; href: string; key: Section }[] = [
  { label: "Projects",   href: "#projects",   key: "projects"   },
  { label: "Experience", href: "#experience", key: "experience" },
  { label: "Contact",    href: "#contact",    key: "contact"    },
];

// Map each section DOM id to a nav key
const SECTION_MAP = [
  { id: "about",      key: "home"       },
  { id: "projects",   key: "projects"   },
  { id: "experience", key: "experience" },
  { id: "contact",    key: "contact"    },
] as const;

function detectSection(y: number): Section {
  const offset = y + window.innerHeight * 0.38;
  let current: Section = "home";
  for (const { id, key } of SECTION_MAP) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= offset) current = key;
  }
  return current;
}

const LENS_TRANSITION = { type: "spring", stiffness: 480, damping: 36 } as const;

export default function Nav() {
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState<Section>("home");

  useEffect(() => {
    // Set correct section on mount (handles page refresh mid-scroll)
    setActive(detectSection(window.scrollY));

    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY && y > 80);
      lastY = y;
      setActive(detectSection(y));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="nav-outer">
      <motion.div
        className="nav-float"
        animate={{ y: hidden ? -80 : 0, opacity: hidden ? 0 : 1 }}
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      >
        <nav className="nav-pill" aria-label="Main navigation">

          {/* R. — home indicator */}
          <span className="nav-item-wrap">
            {active === "home" && (
              <motion.span layoutId="nav-lens" className="nav-lens" transition={LENS_TRANSITION} />
            )}
            <a
              href="#about"
              className={`nav-logo${active === "home" ? " is-active" : ""}`}
              aria-label="Rithvik Praveen Kumar — home"
              onClick={() => setActive("home")}
            >
              R.
            </a>
          </span>

          <span className="nav-sep" aria-hidden="true">/</span>

          {NAV_ITEMS.map((item, i) => (
            <Fragment key={item.key}>
              {i > 0 && <span className="nav-sep" aria-hidden="true">\</span>}
              <span className="nav-item-wrap">
                {active === item.key && (
                  <motion.span layoutId="nav-lens" className="nav-lens" transition={LENS_TRANSITION} />
                )}
                <a
                  href={item.href}
                  className={`nav-pill-item${active === item.key ? " is-active" : ""}`}
                  onClick={() => setActive(item.key)}
                >
                  {item.label}
                </a>
              </span>
            </Fragment>
          ))}

          <span className="nav-divider" aria-hidden="true" />

          <div className="nav-admin-wrap">
            <a href="/admin/login" className="nav-admin-btn">I am Rithvik</a>
            <span className="nav-admin-tooltip">
              <span className="nav-admin-tooltip-title">Live content editor</span>
              Add, edit, or remove projects and experience entries directly on the site — changes go live instantly, no code required.
            </span>
          </div>
        </nav>
      </motion.div>
    </div>
  );
}
