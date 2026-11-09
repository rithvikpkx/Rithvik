"use client";
import { useEffect } from "react";

/** Mounted in the admin layout: an admin page load proves the owner is signed in, so ask the server to mark this
 *  browser as his (long-lived cookie) and purge anything it tracked earlier. Once per tab; renders nothing. */
export default function OwnerMark() {
  useEffect(() => {
    try { if (sessionStorage.getItem("rv_owner_marked")) return; sessionStorage.setItem("rv_owner_marked", "1"); } catch { /* storage off: just ask again */ }
    fetch("/api/t/owner", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
