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

/** Renders whichever overlay is open plus the toast stack. The agent dock is always
 *  present (it is the bottom-centre prompt); it expands when overlay.kind === "agent". */
export default function Overlays() {
  const { overlay } = useSite();
  return (
    <>
      {overlay?.kind === "case" && <CaseSheet slug={overlay.slug} />}
      {overlay?.kind === "composer" && <ComposerWindow subject={overlay.subject} body={overlay.body} />}
      {overlay?.kind === "resume" && <ResumeWindow />}
      {overlay?.kind === "play" && <PlayWindow initialId={overlay.id} />}
      <AgentDock />
      <Toasts />
    </>
  );
}
