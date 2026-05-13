"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import type { MotionValue } from "motion/react";

const ITEMS = ["About", "Projects", "Experience", "Contact"] as const;
type Item = typeof ITEMS[number];

/** Single nav link with dock-style scale based on mouse proximity. */
function PillItem({
  label,
  href,
  mouseX,
  isActive,
  onClick,
}: {
  label: string;
  href: string;
  mouseX: MotionValue<number>;
  isActive: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const distance = useTransform(mouseX, (x) => {
    if (!ref.current || x === Infinity) return 999;
    const r = ref.current.getBoundingClientRect();
    return Math.abs(x - (r.left + r.width / 2));
  });

  const scale = useSpring(
    useTransform(distance, [0, 60, 120], [1.32, 1.12, 1]),
    { stiffness: 420, damping: 26, mass: 0.5 }
  );

  return (
    <span className="nav-item-wrap">
      {isActive && (
        <motion.span
          layoutId="nav-lens"
          className="nav-lens"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <motion.a
        ref={ref}
        href={href}
        onClick={onClick}
        className={`nav-pill-item${isActive ? " is-active" : ""}`}
        style={{ scale }}
      >
        {label}
      </motion.a>
    </span>
  );
}

export default function Nav() {
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState<Item>("About");
  const mouseX = useMotionValue(Infinity);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY && y > 80);
      lastY = y;
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
        <nav
          className="nav-pill"
          aria-label="Main navigation"
          onMouseMove={(e) => mouseX.set(e.clientX)}
          onMouseLeave={() => mouseX.set(Infinity)}
        >
          <Link href="#" className="nav-logo" aria-label="Rithvik Praveen Kumar — home">
            R.
          </Link>

          <span className="nav-sep" aria-hidden="true">/</span>

          {ITEMS.map((item, i) => (
            <Fragment key={item}>
              {i > 0 && <span className="nav-sep" aria-hidden="true">\</span>}
              <PillItem
                label={item}
                href={`#${item.toLowerCase()}`}
                mouseX={mouseX}
                isActive={active === item}
                onClick={() => setActive(item)}
              />
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
