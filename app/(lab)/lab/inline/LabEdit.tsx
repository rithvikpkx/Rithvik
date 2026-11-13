"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { EditModeContext } from "@/components/EditModeProvider";
import InlineEditLayer, { type SaveFn } from "@/components/site/InlineEditLayer";
import { useSite } from "@/components/site/SiteProvider";

// Client-only like in production (EditModeOverlays): the bar reads localStorage in its initial state.
const InlineLoginPanel = dynamic(() => import("@/components/InlineLoginPanel"), { ssr: false });
const AdminBar = dynamic(() => import("@/components/AdminBar"), { ssr: false });

declare global { interface Window { __saves?: [string, string][] } }

/** Stub for saveField: waits a beat, records the call on `window.__saves`, and fails when the text contains FAIL (tests rollback). */
const save: SaveFn = async (key, value) => {
  (window.__saves ??= []).push([key, value]);
  await new Promise((r) => setTimeout(r, 400));
  return value.includes("FAIL") ? { ok: false, error: "Stub server said no" } : { ok: true };
};

/** Lab-only: an EditModeContext with no Supabase behind it, plus the real login panel, admin bar and inline edit layer.
 *  Initial state comes from the URL (`bar`, `panel`) so a screenshot script can open each piece directly. */
export default function LabEdit({ bar, panel, children }: { bar: boolean; panel: boolean; children: React.ReactNode }) {
  const { toast } = useSite();
  const [isEditing, setIsEditing] = useState(bar);
  const [inlineOn, setInlineOn] = useState(true);
  const [barHidden, setBarHidden] = useState(false);
  const [panelOpen, setPanelOpen] = useState(panel);
  return (
    <EditModeContext.Provider value={{
      isEditing, inlineOn, setInlineOn, barHidden, session: null, panelOpen,
      openPanel: () => (isEditing ? setBarHidden((h) => !h) : setPanelOpen(true)),
      closePanel: () => setPanelOpen(false),
      requestOtp: async (email) => (email.trim().toLowerCase() === "rithvik@example.com" ? null : "Nice try. That is not the Rithvik email."),
      verifyOtpCode: async () => { setPanelOpen(false); setIsEditing(true); return null; },
      logout: () => setIsEditing(false),
    }}>
      {children}
      <InlineLoginPanel />
      <AdminBar onEditContent={() => toast("Edit content window (stub)")} />
      {isEditing && inlineOn && <InlineEditLayer save={save} toast={toast} />}
    </EditModeContext.Provider>
  );
}
