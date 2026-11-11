import { COMMANDS, isAdminCommand, parseCommand } from "@/lib/agent/commands";
import { findEntry } from "@/lib/agent/targets";
import { GAMES, PLAY } from "@/lib/play/games";
import type { Content } from "@/lib/content/types";
import { adminMode, runAdmin } from "./adminCommands";
import type { Design, NewItem, Turn } from "./types";

/** Everything a slash command may touch; the hook supplies it so this file stays free of React. */
export type SlashCtx = {
  add: (item: NewItem, undo?: () => void) => void;
  clear: () => void;
  toggleFull: () => void;
  close: () => void;
  history: string[];
  turns: Turn[];
  /** The whole panel as Markdown (rows, tool calls, sources, header). */
  exportMd: () => string;
  /** Adds the /usage row (rate limit, tokens, timings). */
  usage: () => void;
  content: Content;
  design: Design;
  openCase: (slug: string) => void;
  openResume: () => void;
  openComposer: (subject?: string) => void;
  openPlay: (id?: string) => void;
  lite: boolean;
  setLite: (on: boolean) => void;
  /** Copies the conversation link; only meaningful once a turn has been answered (`canShare`). */
  share: () => void;
  canShare: boolean;
  download: () => void;
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

/* eslint-disable @next/next/no-location-assign-relative-destination -- /status and /buffett are deliberate full document loads */

/** Runs one slash command as a tool-call row. Every command acts at once: the visitor typed it, so no
 *  confirmation. Unknown commands never go to the model. */
export function runSlash(raw: string, c: SlashCtx): void {
  const cmd = parseCommand(raw);
  if (!cmd) return;
  const { arg } = cmd;
  // Edit-mode commands (hidden from /help); for a visitor they fall through to "Unknown command".
  if (adminMode() && isAdminCommand(cmd)) { void runAdmin(cmd.name, arg, c.add); return; }
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
    case "/home": tool("Navigate", "top", "Scrolled to the top"); window.scrollTo({ top: 0, behavior: "smooth" }); break;
    case "/about": tool("Navigate", "#about", "Jumped to about"); c.scroll(["about", "top"]); break;
    case "/work": tool("Navigate", "#work", `${c.content.projects.length} projects`); c.scroll(["work", "projects", "top"]); break;
    // `/contact <subject>` keeps its old meaning (draft an email); bare /contact is the section.
    case "/contact":
      if (!arg) { tool("Navigate", "#contact", "Jumped to contact"); c.scroll(["contact", "top"]); break; }
    // falls through
    case "/compose": tool("Compose", arg, "Opening the email composer"); c.openComposer(arg); break;
    case "/status": tool("Navigate", "/status", "Opening status"); window.location.href = "/status"; break;
    case "/buffett": tool("Navigate", "/buffett", "Opening the plain-HTML page"); window.location.href = "/buffett"; /* full load: separate root layout */ break;
    case "/play": {
      const a = arg.toLowerCase();
      const g = a && PLAY.find((x) => x.id === a || x.name.toLowerCase().includes(a));
      if (g) { tool("Play", g.id, g.name); c.openPlay(g.id); }
      else tool("ListGames", a ? `no match: ${arg}` : "all", `${PLAY.map((x) => x.id).join(" · ")} (${GAMES.length} games)`);
      break;
    }
    case "/palette": {
      const pals = (c.design?.entries ?? []).filter((e) => e.kind === "palette");
      const list = pals.map((e) => ({ id: e.id, name: e.kind === "palette" ? e.name : e.id, words: [] as string[] }));
      if (!arg || arg === "list") { tool("ListPalettes", "", list.map((e) => e.id).join(" · ") || "none"); break; }
      const pick = findEntry(list, arg);
      if (!pick || !c.design) { tool("SwitchPalette", arg, "Unknown palette. Try /palette list"); break; }
      const d = c.design;
      const prev = d.current;
      d.setDesign(pick.id);
      tool("SwitchPalette", pick.id, `Applied ${pick.name}`, () => d.setDesign(prev));
      break;
    }
    case "/lite": {
      const a = arg.toLowerCase();
      const on = a === "on" ? true : a === "off" ? false : !c.lite;
      c.setLite(on);
      tool("Lite", a || "toggle", on ? "Performance mode on" : "Performance mode off", () => c.setLite(!on));
      break;
    }
    case "/share":
      if (!c.canShare) tool("Share", "", "Ask something first, then there is a conversation to share");
      else { c.share(); tool("Share", "link", "Copying a read-only link"); }
      break;
    case "/download":
      if (!c.turns.length) tool("Download", "markdown", "Nothing to download yet");
      else { c.download(); tool("Download", "markdown", "Saved as Markdown"); }
      break;
    case "/voice": tool("Voice", "push-to-talk", "Hold the mic button in the prompt bar, speak, then release; the transcript lands in the input for you to send"); break;
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
    case "/export": case "/copy": {
      if (!c.turns.length) { tool("Export", "markdown", "Nothing to export yet"); break; }
      c.copy(c.exportMd(), "Chat copied");
      tool("Export", "markdown", `${c.turns.length} turn${c.turns.length === 1 ? "" : "s"} copied`);
      break;
    }
    case "/usage": c.usage(); break;
    case "/history": tool("History", "recent", c.history.slice(0, 6).join(" · ") || "No prompts yet"); break;
    case "/fullscreen": c.toggleFull(); break;
    case "/quit": c.close(); break;
    default: tool("Command", cmd.name, `Unknown command. /help lists them (${COMMANDS.length})`);
  }
}
