"use client";
import { useSyncExternalStore } from "react";

/** Re-renders subscribers every 15s; enough for a minute-resolution clock. */
const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 15000);
  return () => clearInterval(id);
};
const minute = () => Math.floor(Date.now() / 60000);

/** Live local time in an IANA zone ("9:27 PM"). Empty on the server so SSR and hydration agree. */
export default function Clock({ tz }: { tz: string }) {
  const m = useSyncExternalStore(subscribe, minute, () => null);
  const text = m === null ? "" : new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(m * 60000));
  return <time className="cl-clock">{text}</time>;
}
