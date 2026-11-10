"use client";
// Thermal's Experience pieces: a heat pipe that conducts heat down from each role, and a warm body (a mortarboard
// seen through the thermal camera) whose hottest point follows the pointer.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

/** A cold copper pipe; heat runs down it with scroll, a white-hot front leading, convection shimmering behind. */
function HeatPipe() {
  return <><i className="xp-track tx-pipe" /><i className="xp-fill tx-heat" /><i className="xp-head"><b className="tx-front" /></i></>;
}

/** The warm body: a mortarboard silhouette filled with the active palette's heat, a crosshair on its max. */
function WarmBody() {
  return (
    <div className="tx-body">
      <i className="tx-glow" />
      <i className="tx-shape" />
      <i className="tx-cross" />
      <svg className="tx-scale" viewBox="0 0 8 100" preserveAspectRatio="none" focusable="false"><rect width="8" height="100" fill="url(#tx-ramp)" /><defs><linearGradient id="tx-ramp" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="var(--rh3)" /><stop offset=".4" stopColor="var(--rh2)" /><stop offset=".7" stopColor="var(--rh1)" /><stop offset="1" stopColor="var(--rh0)" /></linearGradient></defs></svg>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: HeatPipe, EducationObject: WarmBody };
