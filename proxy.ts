import { NextResponse, type NextRequest } from "next/server";
import { ownerCookies, safeEqual } from "@/lib/track/owner";

/** Owner opt-out for devices where he never logs in: `/?notrack=<TRACKING_OWNER_KEY>` sets the owner cookies,
 *  `/?notrack=off&key=<TRACKING_OWNER_KEY>` clears them. Either way the params are stripped by a redirect, and a wrong
 *  or missing key changes nothing (the response is the same, so it confirms nothing). Runs only when `notrack` is present. */
export function proxy(req: NextRequest) {
  const url = req.nextUrl.clone();
  const p = url.searchParams.get("notrack") ?? "";
  const off = p === "off";
  const supplied = off ? (url.searchParams.get("key") ?? "") : p;
  url.searchParams.delete("notrack");
  if (off) url.searchParams.delete("key");

  const res = NextResponse.redirect(url);
  const secret = process.env.TRACKING_OWNER_KEY;
  if (secret && supplied && safeEqual(supplied, secret)) {
    for (const c of ownerCookies(!off, url.protocol === "https:")) res.cookies.set(c.name, c.value, c.options);
  }
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: [{ source: "/:path*", has: [{ type: "query", key: "notrack" }] }] };
