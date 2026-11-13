"use client";
import dynamic from "next/dynamic";
import { useSite } from "../SiteProvider";

// Each layer is its own lazy chunk; nothing loads until it is first opened.
const CaseSheet = dynamic(() => import("./CaseSheet"), { ssr: false });
const ComposerWindow = dynamic(() => import("./ComposerWindow"), { ssr: false });
const ResumeWindow = dynamic(() => import("./ResumeWindow"), { ssr: false });
const PlayWindow = dynamic(() => import("./PlayWindow"), { ssr: false });
const AgentDock = dynamic(() => import("./AgentDock"), { ssr: false });
const Toasts = dynamic(() => import("./Toasts"), { ssr: false });

/** Renders every open layer plus the toast stack; the windows float over the page together. The agent dock is
 *  always present (it is the bottom-centre prompt); it expands when the agent layer is open. A key per opening
 *  remounts a window when it is opened again with new content (another project, a new draft). */
export default function Overlays() {
  const { layers: l } = useSite();
  return (
    <>
      {l.case && <CaseSheet key={l.case.slug} slug={l.case.slug} />}
      {l.composer && <ComposerWindow key={`${l.composer.subject}\u0000${l.composer.body ?? ""}`} subject={l.composer.subject} body={l.composer.body} agentSessionId={l.composer.meta?.agentSessionId} />}
      {l.resume && <ResumeWindow />}
      {l.play && <PlayWindow key={l.play.id ?? ""} initialId={l.play.id} />}
      <AgentDock />
      <Toasts />
    </>
  );
}
