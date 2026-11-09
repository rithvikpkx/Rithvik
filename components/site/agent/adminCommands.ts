/** Client runner for the edit-mode slash commands (/embed, /temp, /docs, /resume sync). The
 *  definitions and pure formatting live in lib/agent/commands.ts; this file only calls the existing
 *  server actions and reports each result as a tool row. */
import { backfillPrimaryEmbeddings, listSecondaryDocuments } from "@/app/admin/rag-actions";
import { getRagTemperature, updateRagTemperature } from "@/app/admin/actions";
import { formatDocs, formatEmbed, parseTemp } from "@/lib/agent/commands";
import type { NewItem } from "./types";

// Module flag instead of a SlashCtx field so useAgent.ts stays untouched; AgentDock mirrors edit mode into it.
let admin = false;

/** Called by the dock whenever edit mode flips. Server actions re-check auth, so this only gates visibility. */
export function setAdminMode(on: boolean): void {
  admin = on;
}

/** Whether admin commands are currently allowed to run. */
export function adminMode(): boolean {
  return admin;
}

/** Calls the resume sync route; the resume stream owns it, so a 404 reads as "not deployed yet". */
async function resumeSync(): Promise<string> {
  const res = await fetch("/api/resume/sync", { method: "POST" });
  if (res.status === 404) return "Not available yet: /api/resume/sync is not deployed on this build";
  const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
  if (!res.ok) return `Failed (${res.status}): ${body?.error ?? body?.message ?? "no details"}`;
  return body?.message ?? "Resume synced";
}

/** Runs one admin command and appends its tool row (after the call, since rows cannot be patched from here). */
export async function runAdmin(name: string, arg: string, add: (item: NewItem) => void): Promise<void> {
  const tool = (n: string, args: string, result: string) => add({ kind: "tool", name: n, args, result });
  try {
    if (name === "/embed") {
      add({ kind: "note", text: "Re-embedding primary content..." });
      tool("Embed", "primary", formatEmbed(await backfillPrimaryEmbeddings()));
    } else if (name === "/docs") {
      tool("ListDocs", "secondary", formatDocs(await listSecondaryDocuments()));
    } else if (name === "/temp") {
      if (!arg.trim()) { tool("Temperature", "current", String(await getRagTemperature())); return; }
      const t = parseTemp(arg);
      if (!t.ok) { tool("Temperature", arg.trim(), t.error); return; }
      await updateRagTemperature(t.value);
      tool("Temperature", String(t.value), `Set to ${t.value}`);
    } else {
      tool("ResumeSync", "POST /api/resume/sync", await resumeSync());
    }
  } catch (e) {
    tool("Admin", name, `Failed: ${e instanceof Error ? e.message : "unknown error"}`);
  }
}
