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

/** Permanently deletes one conversation (its messages go with it by cascade). */
export async function deleteChat(fd: FormData) {
  await requireAuth();
  const id = fd.get("id");
  if (!isUuid(id)) return;
  const { error } = await adminClient().from("agent_sessions").delete().eq("id", id);
  if (error) { console.error("[agentlog] chat delete failed:", error.message); throw new Error("Could not delete."); }
  revalidatePath("/admin", "layout");
}

/** Permanently deletes a visitor: their replay files, their conversations, then the visitor row (visits, events and
 *  replay rows go with it by cascade). Files first, so a failure never leaves storage nothing points at. */
export async function deleteVisitor(fd: FormData) {
  await requireAuth();
  const id = fd.get("id");
  if (!isUuid(id)) return;
  const db = adminClient();
  const { data: visits } = await db.from("visits").select("id").eq("visitor_id", id);
  const ids = (visits ?? []).map((v) => v.id as string);
  if (ids.length) {
    const { data: rows } = await db.from("replays").select("storage_path").in("visit_id", ids);
    const paths = (rows ?? []).map((r) => r.storage_path as string).filter(Boolean);
    for (let i = 0; i < paths.length; i += 900) {
      const { error } = await db.storage.from("replays").remove(paths.slice(i, i + 900));
      if (error) { console.error("[track] replay file delete failed:", error.message); throw new Error("Could not delete."); }
    }
  }
  const chats = await db.from("agent_sessions").delete().eq("visitor_id", id);
  const who = await db.from("visitors").delete().eq("id", id);
  const error = chats.error ?? who.error;
  if (error) { console.error("[track] visitor delete failed:", error.message); throw new Error("Could not delete."); }
  revalidatePath("/admin", "layout");
}
