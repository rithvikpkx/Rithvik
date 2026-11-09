/** Slash commands for the agent prompt. Pure: parsing and palette matching only; running them
 *  (which touches the site) lives in components/site/agent/slash.ts. */

export const COMMANDS: [name: string, help: string][] = [
  ["/help", "Show commands and shortcuts"],
  ["/resume", "Open the resume"],
  ["/projects", "List projects, or /projects <name>"],
  ["/experience", "Show experience"],
  ["/contact", "Draft an email to Rithvik"],
  ["/theme", "Switch design: /theme <name|random|list>"],
  ["/now", "Where Rithvik is right now"],
  ["/clear", "Clear the conversation"],
  ["/export", "Copy the transcript as Markdown"],
  ["/history", "Show recent prompts"],
  ["/fullscreen", "Toggle full screen"],
  ["/quit", "Close the agent"],
];

/** Commands that take no argument, so the palette runs them on Enter instead of completing. */
export const NO_ARG = new Set(["/help", "/resume", "/experience", "/now", "/clear", "/export", "/history", "/fullscreen", "/quit"]);

/** Splits "/projects boiler frame" into name and argument; null when the input is not a command. */
export function parseCommand(raw: string): { name: string; arg: string; known: boolean } | null {
  const s = raw.trim();
  if (!s.startsWith("/")) return null;
  const [head, ...rest] = s.split(/\s+/);
  const name = head.toLowerCase();
  return { name, arg: rest.join(" "), known: COMMANDS.some(([c]) => c === name) };
}

/** Palette rows for what is typed so far; empty once an argument has started or nothing matches. */
export function matchCommands(input: string): typeof COMMANDS {
  if (!input.startsWith("/") || /\s/.test(input)) return [];
  const v = input.toLowerCase();
  return COMMANDS.filter(([c]) => c.startsWith(v));
}
