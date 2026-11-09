import { NextResponse } from "next/server";
import { isAdmin } from "@/app/admin/auth-helper";
import { ownerCookies } from "@/lib/track/owner";
import { purgeVisitor } from "@/lib/track/store";
import { visitorIdFromCookie } from "@/lib/track/schema";

/** POST /api/t/owner: marks this browser as the owner's (long-lived `rv_owner` cookie plus a readable mirror) once an
 *  admin session is confirmed, and deletes any visitor record this browser made before it was marked. Called by the
 *  tracker when edit mode starts and by the admin pages. Logout never clears it. 401 for anyone who is not the admin. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  for (const c of ownerCookies(true, new URL(req.url).protocol === "https:" || process.env.NODE_ENV === "production")) res.cookies.set(c.name, c.value, c.options);
  const id = visitorIdFromCookie(req.headers.get("cookie"));
  if (id) await purgeVisitor(id);
  return res;
}
