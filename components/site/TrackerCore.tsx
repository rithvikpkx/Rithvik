"use client";
import { useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { EditModeContext } from "@/components/EditModeProvider";
import { createEngine, devFlag, type Engine } from "@/lib/track/engine";
import { observe } from "@/lib/track/observers";
import { startReplay } from "@/lib/track/replay";
import type { TrackEvent } from "@/lib/track/bus";
import { useSite } from "./SiteProvider";

/** The running tracker (loaded after idle by Tracker.tsx): owns the engine, wires route and overlay changes to
 *  events, starts session replay after the first interaction (or 3 s idle), and shuts everything down when the
 *  owner enters edit mode (which also marks this browser as his so it is never tracked again). Renders nothing. */
export default function TrackerCore() {
  const path = usePathname();
  const { overlay } = useSite();
  const editing = useContext(EditModeContext)?.isEditing ?? false;
  const eng = useRef<Engine | null>(null);
  const lastPath = useRef<string | null>(null);

  // Start once: engine, observers, queued events from track(), replay.
  useEffect(() => {
    const e = createEngine();
    eng.current = e;
    const stopObs = observe(e);
    const drain = () => {
      const w = window as unknown as { __rvq?: TrackEvent[] };
      for (const q of w.__rvq?.splice(0) ?? []) e.emit(q.t, q.d, q.at);
    };
    drain();
    window.addEventListener("rv:q", drain);
    const hide = () => { if (document.visibilityState === "hidden") e.flush(true); };
    document.addEventListener("visibilitychange", hide);
    const bye = () => e.flush(true);
    addEventListener("pagehide", bye);

    // Replay: first interaction or 3 s of idle, whichever comes first.
    let started = false;
    const unlisten = () => { removeEventListener("pointerdown", begin); removeEventListener("keydown", begin); removeEventListener("scroll", begin); };
    const begin = () => {
      if (started) return;
      started = true;
      unlisten();
      if (!devFlag("rv-norec")) startReplay(e).catch(() => {});
    };
    addEventListener("pointerdown", begin, { passive: true }); addEventListener("keydown", begin, { passive: true }); addEventListener("scroll", begin, { passive: true });
    const idle = setTimeout(begin, 3000);

    e.onStop(() => { stopObs(); clearTimeout(idle); unlisten(); started = true; window.removeEventListener("rv:q", drain); document.removeEventListener("visibilitychange", hide); removeEventListener("pagehide", bye); });
    return () => { e.stop(); eng.current = null; lastPath.current = null; }; // reset so a re-mounted engine (strict mode) re-reports the page
  }, []);

  // Page views, including client navigations such as /work/<slug> deep links.
  useEffect(() => {
    if (lastPath.current === path) return;
    lastPath.current = path;
    eng.current?.emit("pageview", { path, title: document.title.slice(0, 120) });
  }, [path]);

  // Overlays opened over the page.
  useEffect(() => {
    if (!overlay) return;
    const e = eng.current;
    if (!e) return;
    const ref = overlay.kind === "case" ? overlay.slug : overlay.kind === "composer" ? overlay.subject : overlay.kind === "agent" ? overlay.question : overlay.kind === "play" ? overlay.id : undefined;
    e.emit("overlay", { kind: overlay.kind, ref: ref?.slice(0, 100) });
    if (overlay.kind === "resume") e.emit("resume", { action: "open" });
    if (overlay.kind === "agent") e.emit("agent_open", { question: overlay.question?.slice(0, 100) });
    if (overlay.kind === "composer") e.emit("composer_open", { subject: overlay.subject.slice(0, 100) });
  }, [overlay]);

  // Edit mode means the owner: stop, and have the server remember this browser.
  useEffect(() => {
    if (!editing) return;
    eng.current?.stop();
    fetch("/api/t/owner", { method: "POST" }).catch(() => {});
  }, [editing]);

  return null;
}
