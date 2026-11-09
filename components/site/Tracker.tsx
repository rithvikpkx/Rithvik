"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { devFlag } from "@/lib/track/engine";

// A separate lazy chunk, fetched only after the page has settled, so tracking never delays first paint.
const TrackerCore = dynamic(() => import("./TrackerCore"), { ssr: false });

/** True where tracking must not run: the owner's browser (readable mirror cookie), automation, or the `rv-off` dev toggle. */
function skip(): boolean {
  return /(?:^|; )rv_owner_seen=1/.test(document.cookie) || navigator.webdriver === true || devFlag("rv-off");
}

/** Mounts the tracker after idle (or 2.5 s at most). Renders nothing itself. */
export default function Tracker() {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (skip()) return;
    const run = () => setGo(true);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(run, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = setTimeout(run, 2000); // Safari has no requestIdleCallback
    return () => clearTimeout(t);
  }, []);
  return go ? <TrackerCore /> : null;
}
