"use client";
// Tracker's Experience pieces: a tracked link between detections (keypoints along a path, a reticle on its
// front), and the education object as a detection: a wireframe mortarboard with keypoints in a lagging box.
import type { Skin } from "@/lib/designs/skin";
import "./experience.css";

// the mortarboard's keypoints (viewBox 0 0 200 200): board corners, cap rim, tassel
const KP: [number, number][] = [[100, 46], [176, 80], [100, 114], [24, 80], [58, 100], [142, 100], [58, 138], [142, 138], [100, 152], [164, 84], [164, 134]];
const BONES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 6], [5, 7], [6, 8], [8, 7], [9, 10]];

/** A dashed predicted path; behind the scroll front it is a confirmed track with keypoints, a reticle leading. */
function Track({ index }: { index: number; count: number }) {
  return <><i className="xp-track kx-pred" /><i className="xp-fill kx-trk" /><i className="xp-head"><b className="kx-ret" data-id={`trk ${String(index + 1).padStart(2, "0")}`} /></i></>;
}

/** The detection: wireframe + keypoints, a bounding box that trails the object, a class label with confidence. */
function Detection() {
  return (
    <div className="kx-det" data-tk="school" data-tk-label="school">
      <svg className="kx-wire" viewBox="0 0 200 200" focusable="false">
        <path className="kx-fill" d="M100 46 176 80 100 114 24 80Z" />
        <path className="kx-rim" d="M58 100v38c0 18 84 18 84 0v-38" />
        {BONES.map(([a, b]) => <line key={`${a}-${b}`} x1={KP[a][0]} y1={KP[a][1]} x2={KP[b][0]} y2={KP[b][1]} />)}
        {KP.map(([x, y], i) => <circle key={i} className="kx-kp" cx={x} cy={y} r="3.2" style={{ animationDelay: `${-i * 0.23}s` }} />)}
      </svg>
      <div className="kx-box"><i /><i /><i /><i /><span>school 0.98</span></div>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Track, EducationObject: Detection };
