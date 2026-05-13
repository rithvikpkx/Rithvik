"use client";
import React, { useEffect, useState } from "react";
import { useEditMode } from "./EditModeProvider";
import EditableText from "./EditableText";
import EditableTagList from "./EditableTagList";
import EduLogo from "./EduLogo";
import FadeIn from "./FadeIn";
import { updateEducation } from "@/app/admin/actions";
import type { Education } from "@/lib/types";

const HIGHLIGHT_DELAYS = ["0s", "1.4s", "2.8s", "4.2s"];

export default function EducationClient({ initialEntries }: { initialEntries: Education[] }) {
  const { isEditing } = useEditMode();
  const [entries, setEntries] = useState(initialEntries);

  useEffect(() => {
    if (!isEditing) setEntries(initialEntries);
  }, [initialEntries, isEditing]);

  const patch = async (id: string, changes: Partial<Education>) => {
    // Skip saving for the hardcoded fallback entry (migration not yet run)
    if (id === "default") return;
    const prev = entries.find((e) => e.id === id)!;
    const updated = { ...prev, ...changes };
    setEntries((es) => es.map((e) => (e.id === id ? updated : e)));
    try {
      await updateEducation(id, {
        school: updated.school,
        school_url: updated.school_url,
        degree: updated.degree,
        concentrations: updated.concentrations,
        logo_path: updated.logo_path,
        sort_order: updated.sort_order,
        published: updated.published,
      });
    } catch {
      setEntries((es) => es.map((e) => (e.id === id ? prev : e)));
    }
  };

  return (
    <>
      {entries.map((entry) => (
        <FadeIn key={entry.id} delay={0.1} className="edu-card">
          <EduLogo />
          <div className="edu-body">
            {/* School name / URL */}
            {isEditing ? (
              <div className="edu-edit-school">
                <EditableText tag="span" className="edu-school" value={entry.school}
                  onSave={(v) => patch(entry.id, { school: v })} placeholder="School name…" />
                <EditableText tag="span" className="exp-meta-field" value={entry.school_url ?? ""}
                  onSave={(v) => patch(entry.id, { school_url: v || null })} placeholder="School URL…" />
              </div>
            ) : (
              <a href={entry.school_url ?? "#"} target="_blank" rel="noreferrer" className="edu-school">
                {entry.school}
              </a>
            )}

            {/* Degree + concentrations */}
            {isEditing ? (
              <>
                <EditableText tag="p" className="edu-description" value={entry.degree}
                  onSave={(v) => patch(entry.id, { degree: v })} placeholder="Degree…" multiline />
                <div>
                  <p className="edu-conc-label">Concentrations</p>
                  <EditableTagList tags={entry.concentrations}
                    onSave={(concentrations) => patch(entry.id, { concentrations })}
                    className="project-tags" />
                </div>
              </>
            ) : (
              <p className="edu-description">
                {entry.degree} with concentrations in{" "}
                {entry.concentrations.map((c, i) => (
                  <React.Fragment key={c}>
                    <span className="edu-highlight" style={{ "--gd": HIGHLIGHT_DELAYS[i] } as React.CSSProperties}>
                      {c}
                    </span>
                    {i < entry.concentrations.length - 1 ? " and " : ""}
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        </FadeIn>
      ))}
    </>
  );
}
