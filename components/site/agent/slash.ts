import { COMMANDS, parseCommand } from "@/lib/agent/commands";
import type { NewItem } from "./types";

/** Everything a slash command may touch; the hook supplies it so this file stays free of React. */
export type SlashCtx = {
  add: (item: NewItem, undo?: () => void) => void;
  clear: () => void;
  toggleFull: () => void;
  close: () => void;
  history: string[];
};

/** Runs one slash command as a tool-call row. Unknown commands say so rather than going to the model. */
export function runSlash(raw: string, c: SlashCtx): void {
  const cmd = parseCommand(raw);
  if (!cmd) return;
  const tool = (name: string, args: string, result: string) => c.add({ kind: "tool", name, args, result });
  switch (cmd.name) {
    case "/help": c.add({ kind: "help" }); break;
    case "/clear": c.clear(); break;
    case "/history": tool("History", "recent", c.history.slice(0, 6).join(" · ") || "No prompts yet"); break;
    case "/fullscreen": c.toggleFull(); break;
    case "/quit": c.close(); break;
    default: tool("Command", cmd.name, cmd.known ? "Not available here" : `Unknown command. /help lists them (${COMMANDS.length})`);
  }
}
