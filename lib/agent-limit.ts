import "server-only";
import { isAdmin } from "@/app/admin/auth-helper";
import { rateLimit } from "@/lib/rate-limit";
import { ADMIN_SESSION_MS } from "@/lib/admin-tab";

export const CHAT_PER_KEY = 30;  // typed turns per visitor (IP; IPv6 /64) per hour
export const LIVE_PER_KEY = 3;   // voice-mode conversations per visitor per hour (billed by the minute)

/** True only for the owner, the same way the site's own sign-in works: the request comes from a signed-in tab
 *  (`X-Rag-Admin: 1`), carries a real Supabase session for ADMIN_EMAIL, and that sign-in is under 5 hours old. The
 *  cheap checks run first, so ordinary visitors never cost an auth round trip; the `rv_owner` cookie is never trusted. */
export async function adminRequest(req: Request): Promise<boolean> {
  if (req.headers.get("x-rag-admin") !== "1") return false;
  if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(req.headers.get("cookie") ?? "")) return false;
  try { return await isAdmin(ADMIN_SESSION_MS); } catch { return false; }
}

/** rateLimit for the agent's routes, skipped entirely for the signed-in admin (`admin: true`, no window info). */
export async function agentLimit(req: Request, bucket: string, key: string, perKey: number, global: number) {
  if (await adminRequest(req)) return { ok: true as const, info: null, admin: true };
  return { ...(await rateLimit(bucket, key, perKey, global)), admin: false };
}
