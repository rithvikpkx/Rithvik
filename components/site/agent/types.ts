/** Shapes shared by the agent's hook, transcript and slash commands. */
import type { useDesign } from "../DesignProvider";
import type { ArtifactSpec } from "@/lib/agent/artifacts";

/** The current design engine API, or null when no provider is mounted (the lab harness). */
export type Design = ReturnType<typeof useDesign> | null;

/** Every row carries `at` (epoch ms, stamped by the hook) so the Markdown export can time-stamp it. */
export type Item =
  | { id: number; at?: number; kind: "banner" }
  | { id: number; at?: number; kind: "user"; text: string }
  /** A tool call row. `result` undefined = still running (no result line yet); `undo` shows an Undo key (the callback lives in the hook). */
  | { id: number; at?: number; kind: "tool"; name: string; args: string; result?: string; undo?: boolean; lines?: [label: string, value: string][] }
  | { id: number; at?: number; kind: "help" }
  | { id: number; at?: number; kind: "answer"; text: string; streaming: boolean }
  | { id: number; at?: number; kind: "suggest"; chips: string[] }
  /** A chart/table the model asked for: already re-validated on the client, drawn by components/site/charts. */
  | { id: number; at?: number; kind: "artifact"; spec: ArtifactSpec }
  /** Buttons the agent offers under an answer. Nothing runs until one is clicked; the callbacks live in the hook,
   *  keyed by each button's `id`. `clicked` feeds the export and a subtle "done" look. `detail` lists what a
   *  send-style button will do (the meeting request). */
  | { id: number; at?: number; kind: "actions"; buttons: ActionButton[]; detail?: string[] }
  /** Footnotes for the [n] markers the answer actually cited. */
  | { id: number; at?: number; kind: "sources"; items: { n: number; label: string; anchor?: string }[] }
  | { id: number; at?: number; kind: "note"; text: string; tone?: "warn" };

/** An item before it is given an id. */
export type NewItem = Item extends infer T ? (T extends { id: number } ? Omit<T, "id"> : never) : never;

/** A completed exchange: the only thing ever replayed to the server as history or exported. */
export type Turn = { q: string; a: string; suggestions: string[]; at: number };

/** One clickable offer. `key` names the target so duplicates collapse; `once` disables it after one click (a send). */
export type ActionButton = { id: number; key: string; label: string; clicked: boolean; once?: boolean };
