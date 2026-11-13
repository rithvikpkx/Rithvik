"use client";
import { useContext } from "react";
import { EditModeContext } from "@/components/EditModeProvider";
import "./iam.css";

/** The header's "I am Rithvik" button: opens the owner sign-in (or, when already signed in, shows/hides the admin bar).
 *  Each design passes its own button classes so it speaks that look's language; the label collapses to the key icon on
 *  phones (iam.css). Renders nothing outside EditModeProvider (lab harnesses). */
export default function IAmRithvik({ className = "", label = "I am Rithvik" }: { className?: string; label?: string }) {
  const ctx = useContext(EditModeContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      className={`iam ${className}`.trim()}
      onClick={ctx.openPanel}
      aria-label={ctx.isEditing ? "Admin bar" : "I am Rithvik: owner sign-in"}
      aria-haspopup={ctx.isEditing ? undefined : "dialog"}
      title={ctx.isEditing ? (ctx.barHidden ? "Show the admin bar" : "Hide the admin bar") : "Rithvik-only zone. Sign in to edit this site."}
    >
      <svg className="iam-ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.8-9.8M16 7l3 3M14 9l2 2" />
      </svg>
      <span className="iam-l">{ctx.isEditing ? "Admin" : label}</span>
    </button>
  );
}
