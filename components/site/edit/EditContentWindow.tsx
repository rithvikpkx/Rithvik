"use client";
import EditContentUI, { type EditApi } from "./EditContentUI";
import { loadEditData, saveSection, saveProject, saveExperience, saveEducation, reorder, removeRow } from "@/app/admin/content-actions";

// Module-level so the object identity is stable (the UI loads once per identity).
const api: EditApi = { load: loadEditData, saveSection, saveProject, saveExperience, saveEducation, reorder, removeRow };

/** The real window: the edit UI wired to the admin server actions. Loaded lazily, only while editing. */
export default function EditContentWindow({ onClose }: { onClose: () => void }) {
  return <EditContentUI api={api} onClose={onClose} />;
}
