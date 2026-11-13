"use server";
import { requireAuth } from "@/app/admin/auth-helper";
import { getDashboard, summaryInput, writeSummaryCached } from "@/lib/analytics/server";
import { parsePeriod } from "@/lib/analytics/shape";

/** The AI summary for a period: admin only; the model sees the numbers-only digest, cached per period + numbers. */
export async function writeSummary(period: string): Promise<{ text?: string; error?: string }> {
  await requireAuth();
  const p = parsePeriod(period);
  try {
    const d = await getDashboard(p);
    const text = await writeSummaryCached(p, JSON.stringify(summaryInput(d)));
    return text ? { text } : { error: "The model returned nothing. Try again." };
  } catch (e) {
    console.error("[analytics] summary failed:", e instanceof Error ? e.message : e);
    return { error: "The summary could not be written right now." };
  }
}
