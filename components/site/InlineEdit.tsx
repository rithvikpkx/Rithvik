"use client";
import dynamic from "next/dynamic";
import { useContext } from "react";
import { EditModeContext } from "@/components/EditModeProvider";
import { saveField } from "@/app/admin/content-actions";
import { useSite } from "./SiteProvider";

// The editor and its CSS download only once the admin has inline editing on.
const InlineEditLayer = dynamic(() => import("./InlineEditLayer"), { ssr: false });

/** Mounted by SitePage for everyone; renders nothing (so `data-edit` attributes stay inert) unless the signed-in admin has the
 *  admin bar's Inline editing switch on. The server re-checks the admin on every save. */
export default function InlineEdit() {
  const ed = useContext(EditModeContext);
  const { toast } = useSite();
  if (!ed?.isEditing || !ed.inlineOn) return null;
  return <InlineEditLayer save={saveField} toast={toast} />;
}
