"use client";

import { useEffect, useId, useState, type RefObject } from "react";
import { motion, useReducedMotion } from "motion/react";

export interface AnimatedBeamProps {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  /** When true the comet travels vertically (upward) instead of horizontally. */
  vertical?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  repeat?: number;
  repeatDelay?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

// Renders an SVG quadratic-curve path between two DOM nodes, with a gradient
// "comet" travelling along it. Originally from MagicUI; the `cn` className
// helper was dropped (no clsx/tailwind-merge in this project) and a
// prefers-reduced-motion gate was added so the beam holds still for those users.
export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  vertical = false,
  duration = 5,
  delay = 0,
  pathColor = "gray",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#ffaa40",
  gradientStopColor = "#9c40ff",
  repeat = Infinity,
  repeatDelay = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}) => {
  const id = useId();
  const reduceMotion = useReducedMotion();
  const [pathD, setPathD] = useState("");
  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });

  // Gradient sweep direction. Horizontal beams sweep along X; vertical beams
  // sweep along Y (upward) so the comet travels along a near-vertical path.
  const gradientCoordinates = vertical
    ? // Head (y1) starts just below the button and ends just above the photo;
      // tail (y2) trails 14% behind. The comet emerges at the button, glides
      // the full beam at constant speed, and fully clears before the loop.
      { x1: ["50%", "50%"], x2: ["50%", "50%"], y1: ["100%", "-5%"], y2: ["114%", "9%"] }
    : reverse
      ? { x1: ["90%", "-10%"], x2: ["100%", "0%"], y1: ["0%", "0%"], y2: ["0%", "0%"] }
      : { x1: ["10%", "110%"], x2: ["0%", "100%"], y1: ["0%", "0%"], y2: ["0%", "0%"] };

  useEffect(() => {
    const updatePath = () => {
      if (containerRef.current && fromRef.current && toRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const rectA = fromRef.current.getBoundingClientRect();
        const rectB = toRef.current.getBoundingClientRect();

        setSvgDimensions({ width: containerRect.width, height: containerRect.height });

        const startX = rectA.left - containerRect.left + rectA.width / 2 + startXOffset;
        const startY = rectA.top - containerRect.top + rectA.height / 2 + startYOffset;
        const endX = rectB.left - containerRect.left + rectB.width / 2 + endXOffset;
        const endY = rectB.top - containerRect.top + rectB.height / 2 + endYOffset;

        const controlY = startY - curvature;
        setPathD(`M ${startX},${startY} Q ${(startX + endX) / 2},${controlY} ${endX},${endY}`);
      }
    };

    const resizeObserver = new ResizeObserver(() => updatePath());
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    updatePath();

    return () => resizeObserver.disconnect();
  }, [
    containerRef,
    fromRef,
    toRef,
    curvature,
    startXOffset,
    startYOffset,
    endXOffset,
    endYOffset,
  ]);

  return (
    <svg
      fill="none"
      width={svgDimensions.width}
      height={svgDimensions.height}
      xmlns="http://www.w3.org/2000/svg"
      className={["pointer-events-none absolute top-0 left-0 transform-gpu stroke-2", className]
        .filter(Boolean)
        .join(" ")}
      viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
    >
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      {/* The travelling gradient comet — skipped entirely for reduced-motion users. */}
      {!reduceMotion && (
        <>
          <path
            d={pathD}
            strokeWidth={pathWidth}
            stroke={`url(#${id})`}
            strokeOpacity="1"
            strokeLinecap="round"
          />
          <defs>
            <motion.linearGradient
              className="transform-gpu"
              id={id}
              gradientUnits="userSpaceOnUse"
              initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
              animate={{
                x1: gradientCoordinates.x1,
                x2: gradientCoordinates.x2,
                y1: gradientCoordinates.y1,
                y2: gradientCoordinates.y2,
              }}
              transition={{
                delay,
                duration,
                // Constant velocity — an eased curve makes the comet lurch
                // then crawl, which reads as janky on a travelling beam.
                ease: "linear",
                repeat,
                repeatDelay,
              }}
            >
              <stop stopColor={gradientStartColor} stopOpacity="0" />
              <stop stopColor={gradientStartColor} />
              <stop offset="32.5%" stopColor={gradientStopColor} />
              <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </>
      )}
    </svg>
  );
};
