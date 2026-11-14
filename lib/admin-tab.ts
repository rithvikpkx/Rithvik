/** The owner's per-tab sign-in, readable anywhere on the client (EditModeProvider owns it). The agent sends
 *  `X-Rag-Admin: 1` only from a signed-in tab; the server also requires a real admin session under 5 hours old,
 *  so the header alone unlocks nothing. */
export const TAB_AUTH_KEY = "rithvik-tab-auth"; // holds this tab's sign-in expiry (epoch ms)
export const ADMIN_SESSION_MS = 5 * 60 * 60 * 1000;

/** True while this tab is signed in as the owner (within the 5 hours). */
export function adminTab(): boolean {
  try { return Number(sessionStorage.getItem(TAB_AUTH_KEY)) > Date.now(); } catch { return false; }
}
/** Headers for the agent's requests: asks the server to lift limits, which it does only for a verified admin. */
export const adminHeaders = (): Record<string, string> => (adminTab() ? { "X-Rag-Admin": "1" } : {});
