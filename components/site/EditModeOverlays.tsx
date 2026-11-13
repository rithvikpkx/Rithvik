"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useEditMode } from "@/components/EditModeProvider";

// Admin-only chrome: none of it downloads until someone opens the login panel or is editing.
const InlineLoginPanel = dynamic(() => import("@/components/InlineLoginPanel"), { ssr: false });
const AdminBar = dynamic(() => import("@/components/AdminBar"), { ssr: false });
const EditContentWindow = dynamic(() => import("./edit/EditContentWindow"), { ssr: false });
const SecondaryContextPanel = dynamic(() => import("@/components/SecondaryContextPanel"), { ssr: false });

/** Mounts the login panel, admin bar and context panel on the v7 site, lazily. The bar decides for itself when to show. */
export default function EditModeOverlays() {
  const { isEditing, panelOpen } = useEditMode();
  // Once armed the panel stays mounted so its own exit animation can play.
  const [armed, setArmed] = useState(false);
  const [editing, setEditing] = useState(false); // the Edit content window
  if ((panelOpen || isEditing) && !armed) setArmed(true);
  if (!armed) return null;
  return (
    <>
      <InlineLoginPanel />
      <AdminBar onEditContent={() => setEditing(true)} />
      {isEditing && editing && <EditContentWindow onClose={() => setEditing(false)} />}
      {isEditing && <SecondaryContextPanel />}
    </>
  );
}
