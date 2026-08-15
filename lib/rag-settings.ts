/**
 * Runtime-tunable RAG settings, shared by the chat route, the server actions,
 * and the edit-mode UI.
 *
 * These live here rather than in app/admin/actions.ts because that file carries
 * "use server", and a server-actions module may only export async functions —
 * exporting a plain const from it is a build error (which `tsc` does not catch;
 * only the Next compiler does).
 */

/** site_content keys under this prefix are configuration, not content. They are
 *  never embedded — otherwise the bot retrieves its own settings as facts. */
export const RAG_SETTING_PREFIX = "rag.";

export const TEMPERATURE_KEY = "rag.temperature";

export const TEMP_MIN = 0;
/** gpt-4o-mini degrades into incoherence above roughly this point, so the
 *  ceiling is a guard rail rather than a matter of taste. */
export const TEMP_MAX = 1.2;
export const TEMP_DEFAULT = 0.7;

/** Clamps any stored/incoming value into the usable range, falling back to the
 *  default for anything unparseable. */
export function clampTemperature(value: unknown): number {
  // Type-check before Number(): Number(null), Number("") and Number([]) are all
  // 0 — finite, and therefore silently pinned the bot to temperature 0 (fully
  // deterministic output) whenever the stored value was missing or blank.
  if (typeof value !== "number" && typeof value !== "string") return TEMP_DEFAULT;
  if (typeof value === "string" && value.trim() === "") return TEMP_DEFAULT;
  const n = Number(value);
  if (!Number.isFinite(n)) return TEMP_DEFAULT;
  return Math.min(TEMP_MAX, Math.max(TEMP_MIN, n));
}
