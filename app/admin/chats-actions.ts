"use server";
import { revalidatePath } from "next/cache";
import { adminClient } from "@/lib/supabase-server";
import { isUuid } from "@/lib/agent/obs";
import { requireAuth } from "./auth-helper";

/** Updates one session column after the admin check and id validation, then refreshes the chat pages. */
async function patchSession(fd: FormData, patch: (fd: FormData) => Record<string, unknown>) {
  await requireAuth();
  const id = fd.get("id");
  if (!isUuid(id)) return;
  const { error } = await adminClient().from("agent_sessions").update(patch(fd)).eq("id", id);
  if (error) {
    console.error("[agentlog] session update failed:", error.message);
    throw new Error("Could not save.");
  }
  revalidatePath("/admin/chats");
  revalidatePath(`/admin/chats/${id}`);
}

/** Flags or unflags a conversation for follow-up (form field `on` = "1" to flag). */
export async function setFollowUp(fd: FormData) {
  await patchSession(fd, (f) => ({ follow_up: f.get("on") === "1" }));
}

/** Saves the owner's private notes on a conversation (capped at 5000 characters). */
export async function saveNotes(fd: FormData) {
  await patchSession(fd, (f) => ({ notes: String(f.get("notes") ?? "").slice(0, 5000) || null }));
}
