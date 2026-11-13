"use client";
// Ember's Experience pieces: a forged iron rod that molten metal runs down as you scroll, and the Purdue P on the
// anvil, its face glowing hottest where the pointer holds the torch.
import type { Skin } from "@/lib/designs/skin";

/** A dark riveted iron rod; molten metal pours down it with the scroll, a white-hot drop leading the flow. */
function Rod() {
  return <><i className="xp-track ex-rod" /><i className="xp-fill ex-melt" /><i className="xp-head"><b className="ex-drop" /></i></>;
}

/** The Purdue P, forged: iron outline, a red-hot bevel ring, and a face whose heat follows the pointer (torch),
 *  embers lifting off the top edge and the glow spilling onto the anvil below. */
function Anvil() {
  return (
    <div className="ex-forge">
      <i className="ex-spill" />
      <i className="ex-glow" />
      <i className="ex-sil" />
      <i className="ex-ring" />
      <i className="ex-face" />
      <i className="ex-scale" />
      <span className="ex-sparks"><b /><b /><b /><b /><b /></span>
    </div>
  );
}

export const XP: Pick<Skin, "ExperienceConnector" | "EducationObject"> = { ExperienceConnector: Rod, EducationObject: Anvil };
