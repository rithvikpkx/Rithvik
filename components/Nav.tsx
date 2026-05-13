"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useEditMode } from "./EditModeProvider";

type Section = "home" | "projects" | "experience" | "contact";

const NAV_ITEMS: { label: string; href: string; key: Section }[] = [
  { label: "Projects",   href: "#projects",   key: "projects"   },
  { label: "Experience", href: "#experience", key: "experience" },
  { label: "Contact",    href: "#contact",    key: "contact"    },
];

const SECTION_MAP = [
  { id: "about",      key: "home"       },
  { id: "projects",   key: "projects"   },
  { id: "experience", key: "experience" },
  { id: "contact",    key: "contact"    },
] as const;

function detectSection(y: number): Section {
  // If scrolled to the very bottom of the page, always activate the last section.
  if (y + window.innerHeight >= document.documentElement.scrollHeight - 50) {
    return "contact";
  }

  // A section becomes active once its top edge scrolls past the navbar (~70 px).
  // This matches what the user actually sees at the top of the viewport.
  const triggerY = y + 70;
  let current: Section = "home";
  for (const { id, key } of SECTION_MAP) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= triggerY) current = key;
  }
  return current;
}

const LENS_TRANSITION = { type: "spring", stiffness: 480, damping: 36 } as const;

export default function Nav() {
  const [active, setActive] = useState<Section>("home");
  const { isEditing, panelOpen, openPanel, logout } = useEditMode();
  const lockedRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Click handler: immediately set target section and lock scroll tracking
  // for 800 ms so the smooth-scroll animation doesn't bounce the lens.
  const handleClick = (key: Section) => {
    setActive(key);
    lockedRef.current = true;
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => {
      lockedRef.current = false;
      setActive(detectSection(window.scrollY));
    }, 1200);
  };

  useEffect(() => {
    setActive(detectSection(window.scrollY));
    const onScroll = () => {
      if (!lockedRef.current) setActive(detectSection(window.scrollY));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="nav-outer">
      <div className="nav-float">
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
              onClick={() => handleClick("home")}
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
                  onClick={() => handleClick(item.key)}
                >
                  {item.label}
                </a>
              </span>
            </Fragment>
          ))}

          <span className="nav-divider" aria-hidden="true" />

          <div className="nav-admin-wrap">
            {isEditing ? (
              <button
                className="nav-admin-btn is-editing"
                onClick={logout}
                title="Exit edit mode"
              >
                <span className="nav-admin-dot" aria-hidden="true" />
                Editing
              </button>
            ) : (
              <>
                <button
                  className={`nav-admin-btn${panelOpen ? " is-open" : ""}`}
                  onClick={openPanel}
                >
                  I am Rithvik
                </button>
                {!panelOpen && (
                  <span className="nav-admin-tooltip">
                    <span className="nav-admin-tooltip-title">Live content editor</span>
                    Add, edit, or remove projects and experience entries directly on the site — changes go live instantly, no code required.
                  </span>
                )}
              </>
            )}
          </div>
        </nav>
      </div>
    </div>
  );
}
