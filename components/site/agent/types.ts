/** Shapes shared by the agent's hook, transcript and slash commands. */
import type { useDesign } from "../DesignProvider";

/** The current design engine API, or null when no provider is mounted (the lab harness). */
export type Design = ReturnType<typeof useDesign> | null;

/** Every row carries `at` (epoch ms, stamped by the hook) so the Markdown export can time-stamp it. */
export type Item =
  | { id: number; at?: number; kind: "banner" }
  | { id: number; at?: number; kind: "user"; text: string }
  /** A tool call row. `result` undefined = still running (no result line yet); `undo` shows an Undo key (the callback lives in the hook). */
  | { id: number; at?: number; kind: "tool"; name: string; args: string; result?: string; undo?: boolean }
  | { id: number; at?: number; kind: "help" }
  | { id: number; at?: number; kind: "answer"; text: string; streaming: boolean }
  | { id: number; at?: number; kind: "suggest"; chips: string[] }
  /** A permission confirmation for a side effect (the action itself is held by the hook until answered).
   *  `tool` is set when the model requested it, so the row reads as a tool call. `detail` lists exactly what
   *  will happen (the meeting card); `once` means the visitor must confirm every time (no "Always"). */
  | { id: number; at?: number; kind: "ask"; question: string; state: "pending" | "yes" | "no" | "always" | "auto"; tool?: { name: string; args: string }; detail?: string[]; once?: boolean }
  /** Footnotes for the [n] markers the answer actually cited. */
  | { id: number; at?: number; kind: "sources"; items: { n: number; label: string; anchor?: string }[] }
  | { id: number; at?: number; kind: "note"; text: string; tone?: "warn" };

/** An item before it is given an id. */
export type NewItem = Item extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;

/** A completed exchange: the only thing ever replayed to the server as history or exported. */
export type Turn = { q: string; a: string; suggestions: string[]; at: number };

export type Choice = "yes" | "no" | "always";
