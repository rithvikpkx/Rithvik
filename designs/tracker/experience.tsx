"use client";
// Tracker's Experience pieces: a tracked link between detections (keypoints along a path, a reticle on its
// front), and the education object as a detection: the Purdue P with keypoints on its corners in a lagging box.
import type { Skin } from "@/lib/designs/skin";
import { PurdueP } from "@/components/site/layout/purdue";
import "./experience.css";

// keypoints on the Purdue P's corners, in P units (the silhouette's vertices, then the counter's)
const KP: [number, number][] = [[0, 35.1], [5.51, 22.17], [12.59, 22.17], [16.52, 12.93], [9.46, 12.93], [14.96, 0], [54, 0], [64.52, 3.83], [64.04, 13.77], [46.59, 24.69], [39.24, 24.69], [34.81, 35.1], [47.32, 10.53], [35.49, 10.53], [33.95, 14.16], [44.71, 14.16]];

/** A dashed predicted path; behind the scroll front it is a confirmed track with keypoints, a reticle leading. */
function Track({ index }: { index: number; count: number }) {
  return <><i className="xp-track kx-pred" /><i className="xp-fill kx-trk" /><i className="xp-head"><b className="kx-ret" data-id={`trk ${String(index + 1).padStart(2, "0")}`} /></i></>;
}

/** The detection: the Purdue P as a segmentation mask with keypoints on its corners, a bounding box that trails
 *  the object, a class label with confidence. */
function Detection() {
  return (
    <div className="kx-det" data-tk="school" data-tk-label="school">
      <PurdueP className="kx-wire">
        {KP.map(([x, y], i) => <circle key={i} className="kx-kp" cx={x} cy={y} r="0.8" style={{ animationDelay: `${-i * 0.23}s` }} />)}
      </PurdueP>
      <div className="kx-box"><i /><i /><i /><i /><span>purdue 0.99</span></div>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Track, EducationObject: Detection };
