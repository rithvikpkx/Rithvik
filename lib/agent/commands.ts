/** Slash commands for the agent prompt. Pure: parsing and palette matching only; running them
 *  (which touches the site) lives in components/site/agent/slash.ts. */

export const COMMANDS: [name: string, help: string][] = [
  ["/help", "Show commands and shortcuts"],
  ["/home", "Scroll to the top"],
  ["/about", "Jump to the about section"],
  ["/work", "Jump to the work section"],
  ["/projects", "List projects, or /projects <name>"],
  ["/experience", "Show experience"],
  ["/resume", "Open the resume"],
  ["/contact", "Jump to the contact section"],
  ["/compose", "Draft an email to Rithvik: /compose [subject]"],
  ["/play", "List the games, or /play <game>"],
  ["/theme", "Switch design: /theme <name|random|list>"],
  ["/palette", "Switch palette: /palette <slug>"],
  ["/lite", "Performance mode: /lite [on|off]"],
  ["/status", "Open the live status page"],
  ["/buffett", "Open the plain-HTML Warren Buffett page"],
  ["/now", "Where Rithvik is right now"],
  ["/share", "Copy a link to this conversation"],
  ["/copy", "Copy the transcript as Markdown"],
  ["/export", "Copy the transcript as Markdown"],
  ["/download", "Download the transcript as Markdown"],
  ["/voice", "How to talk to the agent"],
  ["/history", "Show recent prompts"],
  ["/usage", "Rate limit, tokens and timings"],
  ["/clear", "Clear the conversation"],
  ["/fullscreen", "Toggle full screen"],
  ["/quit", "Close the agent"],
];

/** Edit-mode only: never in COMMANDS, so /help and the palette stay clean for visitors.
 *  `/resume sync` is the admin form of the visitor's /resume, so it is matched on the argument. */
export const ADMIN_COMMANDS: [name: string, help: string][] = [
  ["/embed", "Re-embed all primary content"],
  ["/temp", "Show or set the chat temperature: /temp <0-1.2>"],
  ["/docs", "List uploaded secondary documents"],
  ["/resume sync", "Sync the resume from the source file"],
];

/** True when this parsed input is an admin command (a visitor typing /resume sync just gets the resume). */
export function isAdminCommand(cmd: { name: string; arg: string }): boolean {
  return ["/embed", "/temp", "/docs"].includes(cmd.name) || (cmd.name === "/resume" && cmd.arg.trim().toLowerCase() === "sync");
}

/** Commands that take no argument, so the palette runs them on Enter instead of completing. */
export const NO_ARG = new Set(["/help", "/home", "/about", "/work", "/resume", "/experience", "/contact", "/status", "/buffett", "/now", "/share", "/copy", "/download", "/voice", "/clear", "/export", "/history", "/usage", "/fullscreen", "/quit", "/embed", "/docs", "/resume sync"]);

/** Commands that do nothing without an argument: a /help chip fills the input instead of running them. */
export const NEEDS_ARG = new Set(["/palette"]);

/** True when clicking a /help chip for this command should run it (everything but NEEDS_ARG). */
export const runsOnClick = (name: string): boolean => !NEEDS_ARG.has(name);

/** Splits "/projects boiler frame" into name and argument; null when the input is not a command. */
export function parseCommand(raw: string): { name: string; arg: string; known: boolean } | null {
  const s = raw.trim();
  if (!s.startsWith("/")) return null;
  const [head, ...rest] = s.split(/\s+/);
  const name = head.toLowerCase();
  return { name, arg: rest.join(" "), known: COMMANDS.some(([c]) => c === name) };
}

/** Palette rows for what is typed so far; empty once an argument has started or nothing matches.
 *  Admin rows are included only when `admin` is true; a space ends the palette except while
 *  still spelling a multi-word admin entry ("/resume s"). */
export function matchCommands(input: string, admin = false): typeof COMMANDS {
  if (!input.startsWith("/")) return [];
  const v = input.toLowerCase();
  const all = admin ? [...COMMANDS, ...ADMIN_COMMANDS] : COMMANDS;
  return all.filter(([c]) => c.startsWith(v) && (!/\s/.test(v) || c.includes(" ")));
}

/** Parses `/temp <n>`: a number in 0-1.2 or an error message (the server clamps too; this refuses clearly instead). */
export function parseTemp(arg: string): { ok: true; value: number } | { ok: false; error: string } {
  const t = arg.trim();
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false, error: "Usage: /temp <0-1.2>" };
  const value = Number(t);
  return value > 1.2 ? { ok: false, error: "Temperature must be between 0 and 1.2" } : { ok: true, value };
}

/** One-line result for /embed from the backfill report. */
export function formatEmbed(r: { projects: number; experience: number; education: number; site_content: number; errors: string[] }): string {
  const n = r.projects + r.experience + r.education + r.site_content;
  const base = `${n} records (${r.projects} projects, ${r.experience} roles, ${r.education} education, ${r.site_content} site)`;
  return r.errors.length ? `${base} · ${r.errors.length} error${r.errors.length === 1 ? "" : "s"}: ${r.errors[0]}` : base;
}

/** One-line result for /docs. */
export function formatDocs(docs: { filename: string; chunk_count: number }[]): string {
  return docs.length ? docs.map((d) => `${d.filename} (${d.chunk_count} chunks)`).join(" · ") : "No documents uploaded";
}
