import { COMMANDS, parseCommand } from "@/lib/agent/commands";
import { findEntry } from "@/lib/agent/targets";
import type { Content } from "@/lib/content/types";
import { buildTranscriptMarkdown } from "@/lib/transcript";
import type { Design, NewItem, Turn } from "./types";

/** Everything a slash command may touch; the hook supplies it so this file stays free of React. */
export type SlashCtx = {
  add: (item: NewItem, undo?: () => void) => void;
  ask: (question: string, key: string, run: () => void) => void;
  clear: () => void;
  toggleFull: () => void;
  close: () => void;
  history: string[];
  turns: Turn[];
  content: Content;
  design: Design;
  openCase: (slug: string) => void;
  openResume: () => void;
  openComposer: (subject?: string) => void;
  scroll: (ids: string[]) => void;
  copy: (text: string, msg: string) => void;
};

/** Local time in the owner's current city, e.g. "7:42 PM PST". */
function localTime(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz, timeZoneName: "short" }).format(new Date());
  } catch {
    return "time unavailable";
  }
}

/** Runs one slash command as a tool-call row. Explicit commands act at once (the visitor typed them);
 *  only /contact asks first, since it opens a window. Unknown commands never go to the model. */
export function runSlash(raw: string, c: SlashCtx): void {
  const cmd = parseCommand(raw);
  if (!cmd) return;
  const { arg } = cmd;
  const tool = (name: string, args: string, result: string, undo?: () => void) => c.add({ kind: "tool", name, args, result }, undo);
  switch (cmd.name) {
    case "/help": c.add({ kind: "help" }); break;
    case "/resume": tool("Navigate", "/resume", "Opening resume"); c.openResume(); break;
    case "/projects": {
      const a = arg.toLowerCase();
      const p = a && c.content.projects.find((x) => x.slug === a || x.slug.includes(a) || x.title.toLowerCase().includes(a));
      if (p) { tool("Navigate", `/work/${p.slug}`, p.title); c.openCase(p.slug); }
      else tool("ListProjects", "all", c.content.projects.map((x) => x.title).join(" · "));
      break;
    }
    case "/experience": {
      const r = c.content.experience;
      tool("ListExperience", "all", `${r.length} roles · ${r.map((x) => `${x.role}, ${x.org}`).join(" · ")}`);
      c.scroll(["experience"]);
      break;
    }
    case "/contact": c.ask(`Draft an email${arg ? ` about "${arg}"` : ""} to Rithvik?`, "compose", () => c.openComposer(arg)); break;
    case "/theme": {
      const d = c.design;
      if (!d) { tool("SwitchDesign", arg || "list", "The design engine is not mounted here"); break; }
      const all = d.entries.map((e) => (e.kind === "design" ? { id: e.id, name: e.meta.name, words: e.meta.keywords, design: true } : { id: e.id, name: e.name, words: [], design: false }));
      const designs = all.filter((e) => e.design);
      if (!arg || arg === "list") { tool("ListDesigns", "", designs.map((e) => e.id).join(" · ")); break; }
      const pool = designs.filter((e) => e.id !== d.current);
      const pick = arg === "random" ? pool[Math.floor(Math.random() * pool.length)] : findEntry(all, arg);
      if (!pick) { tool("SwitchDesign", arg, "Unknown design. Try /theme list"); break; }
      const prev = d.current;
      d.setDesign(pick.id);
      tool("SwitchDesign", pick.id, `Applied ${pick.name}`, () => d.setDesign(prev));
      break;
    }
    case "/now": tool("LocalTime", c.content.now.city, `${localTime(c.content.now.tz)} · building ${c.content.now.building}`); break;
    case "/clear": c.clear(); break;
    case "/export": {
      if (!c.turns.length) { tool("Export", "markdown", "Nothing to export yet"); break; }
      const md = buildTranscriptMarkdown(
        c.turns.flatMap((t) => [
          { role: "user" as const, content: t.q, at: t.at },
          { role: "bot" as const, content: t.a, suggestions: t.suggestions, at: t.at },
        ]),
        Date.now(),
        { skipFirst: false },
      );
      c.copy(md, "Transcript copied as Markdown");
      tool("Export", "markdown", `${c.turns.length} turn${c.turns.length === 1 ? "" : "s"} copied`);
      break;
    }
    case "/history": tool("History", "recent", c.history.slice(0, 6).join(" · ") || "No prompts yet"); break;
    case "/fullscreen": c.toggleFull(); break;
    case "/quit": c.close(); break;
    default: tool("Command", cmd.name, `Unknown command. /help lists them (${COMMANDS.length})`);
  }
}
