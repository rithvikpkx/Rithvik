import "server-only";
import { isAdmin } from "@/app/admin/auth-helper";
import { rateLimit } from "@/lib/rate-limit";

export const CHAT_PER_KEY = 30;  // typed turns per visitor (IP; IPv6 /64) per hour
export const LIVE_PER_KEY = 3;   // voice-mode conversations per visitor per hour (billed by the minute)

/** True when the request carries a real admin sign-in (a Supabase session for ADMIN_EMAIL). The cookie test first
 *  keeps ordinary visitors off the auth round trip; the `rv_owner` device cookie is NOT trusted here (anyone can set it). */
export async function adminRequest(req: Request): Promise<boolean> {
  if (!/(?:^|;\s*)sb-[^=]*-auth-token/.test(req.headers.get("cookie") ?? "")) return false;
  try { return await isAdmin(); } catch { return false; }
}

/** rateLimit for the agent's routes, skipped entirely for the signed-in admin (`admin: true`, no window info). */
export async function agentLimit(req: Request, bucket: string, key: string, perKey: number, global: number) {
  if (await adminRequest(req)) return { ok: true as const, info: null, admin: true };
  return { ...(await rateLimit(bucket, key, perKey, global)), admin: false };
}
