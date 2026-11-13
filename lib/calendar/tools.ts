/** Calendar tools for the agent: OpenAI function schemas, a dispatcher that returns compact JSON plus a one-line
 *  summary for the TUI tool row, and the date/time context the system prompt needs to resolve "next Tuesday".
 *  Nothing here can return more than times and free/busy (see availability.ts). */

import { checkAvailability, suggestTimes, ownerTz, CalendarInputError, CalendarUnavailableError } from "./availability.ts";
import { formatAt, MAX_DAYS } from "./slots.ts";
import { fromWall, toWall } from "./ics.ts";

export type ToolOutput = { result: Record<string, unknown>; summary: string };

const VISITOR_TZ = { type: "string", description: "The visitor's IANA timezone, e.g. America/New_York. Include it whenever you know it." };

/** Chat Completions `tools` entries. Pass `calendarTools` as-is to the model call. */
export const calendarTools = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Check whether Rithvik is free at a specific time. Use for 'is he free Tuesday at 9?'. Returns only free/busy, never what the time is used for.",
      parameters: {
        type: "object",
        properties: {
          startISO: { type: "string", description: "Start as ISO 8601, e.g. 2026-11-10T09:00:00-05:00. Without an offset it is read in visitorTz, else Rithvik's timezone." },
          durationMin: { type: "integer", minimum: 15, maximum: 120, description: "Length in minutes. Default 30." },
          visitorTz: VISITOR_TZ,
        },
        required: ["startISO"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_times",
      description:
        "Suggest free meeting slots, earliest first, spread across days. Use for 'when can we talk?'. Only weekday 10:00-17:00 in Rithvik's timezone is ever offered.",
      parameters: {
        type: "object",
        properties: {
          fromISO: { type: "string", description: "Look from this ISO 8601 time. Default: now." },
          days: { type: "integer", minimum: 1, maximum: MAX_DAYS, description: "How many days to search. Default 7." },
          durationMin: { type: "integer", minimum: 15, maximum: 120, description: "Length in minutes. Default 30." },
          count: { type: "integer", minimum: 1, maximum: 10, description: "How many slots. Default 3." },
          visitorTz: VISITOR_TZ,
        },
        additionalProperties: false,
      },
    },
  },
] as const;

const REASON_LABEL = { busy: "Busy", outside_hours: "Outside hours", past: "In the past", too_far: "Too far ahead" } as const;

/** Parses tool-call arguments (a JSON string or an object) into a plain object, `{}` when unusable. */
function asArgs(args: unknown): Record<string, unknown> {
  let v = args;
  if (typeof v === "string") { try { v = JSON.parse(v); } catch { return {}; } }
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Runs a calendar tool by name. Never throws: input and feed problems come back as `{ error }` for the model to relay. */
export async function runCalendarTool(name: string, args: unknown, now: number = Date.now()): Promise<ToolOutput> {
  const a = asArgs(args);
  const vz = typeof a.visitorTz === "string" ? a.visitorTz : undefined;
  try {
    if (name === "check_availability") {
      const r = await checkAvailability(a.startISO as string, a.durationMin as number | undefined, vz, now);
      const label = r.free ? "Free" : REASON_LABEL[r.reason!];
      return { result: { ...r }, summary: `${label} · ${r.localStart}${r.visitorStart ? ` (${r.visitorStart})` : ""}` };
    }
    if (name === "suggest_times") {
      const slots = await suggestTimes(
        { fromISO: a.fromISO as string | undefined, days: a.days as number | undefined, durationMin: a.durationMin as number | undefined, count: a.count as number | undefined, visitorTz: vz },
        now,
      );
      const days = (a.days as number | undefined) ?? 7;
      return {
        result: { slots },
        summary: slots.length
          ? `${slots.length} free · ${slots.map((s) => s.localStart).join(" · ")}`
          : `No free slots in the next ${days} days`,
      };
    }
    return { result: { error: `unknown tool ${name}` }, summary: "Unknown calendar tool" };
  } catch (err) {
    if (err instanceof CalendarInputError) return { result: { error: err.message }, summary: "Calendar: invalid request" };
    if (err instanceof CalendarUnavailableError) return { result: { error: "calendar_unavailable" }, summary: "Calendar unavailable" };
    console.error("[calendar] tool failed:", err instanceof Error ? err.name : "unknown");
    return { result: { error: "calendar_unavailable" }, summary: "Calendar unavailable" };
  }
}

/** System-prompt paragraph: the current time in his zone, the next 14 dates by weekday, and the availability rules. Pure. */
export function calendarContext(tz: string, now: number = Date.now()): string {
  const day0 = toWall(now, tz) - (toWall(now, tz) % 86_400_000);
  const dates = Array.from({ length: 14 }, (_, i) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" })
      .format(fromWall(day0 + i * 86_400_000 + 12 * 3_600_000, tz)).replace(",", "") + (i === 0 ? " (today)" : ""));
  return [
    `Current time: ${formatAt(now, tz)} (${tz}, ISO ${new Date(now).toISOString()}). Rithvik's timezone is ${tz}.`,
    `Next 14 days: ${dates.join("; ")}.`,
    `He takes meetings weekdays 10:00 AM-5:00 PM in his timezone, in 30-minute slots, up to ${MAX_DAYS} days ahead. Resolve relative dates ("next Tuesday") from the list above and pass ISO 8601 with an offset (or the visitor's zone) to the calendar tools. Report only free or busy; never guess what a busy time is.`,
  ].join("\n");
}

/** Async wrapper over calendarContext() using his live timezone from site content. */
export async function calendarPromptContext(now: number = Date.now()): Promise<string> {
  return calendarContext(await ownerTz(), now);
}
