"use client";
import { useEffect, useState } from "react";

/** Renders a live clock in the West Lafayette (ET) timezone. */
export default function LocalTime() {
  const [time, setTime] = useState("--:-- --");

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("en-US", {
        timeZone: "America/Indiana/Indianapolis",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    const tick = () => setTime(fmt());
    // Defer the first paint off the effect's synchronous path (lands next frame).
    const raf = requestAnimationFrame(tick);
    const id = setInterval(tick, 1000);
    return () => { cancelAnimationFrame(raf); clearInterval(id); };
  }, []);

  return <p className="location-time">{time}</p>;
}
