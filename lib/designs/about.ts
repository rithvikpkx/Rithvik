/** One or two sentences on what each design looks like, for the agent: it uses them to describe a look when it
 *  switches one and to suggest others that fit the visitor's taste. Pure (no imports), so it is cheap everywhere. */
export const DESIGN_ABOUT: Record<string, string> = {
  nimbus: "An 8-bit, pixel-dithered sky: fluffy clouds drift and part around your cursor under a sun (a moon at night). Light, airy and playful.",
  stipple: "A risograph zine on warm peach paper: stippled ink dots that breathe like breath on cold glass, with vermilion and blue overprints. Tactile and tender.",
  glyph: "A terminal dreaming in text: monospace ASCII art and TUI panels on a dark screen, with a vim/tmux feel. For command-line people.",
  prism: "Light split through a glass prism: a clean white page with a rainbow spectrum refracting across it. Bright, optical and minimal.",
  mercury: "Liquid chrome, slow and heavy: molten silver surfaces and ferrofluid motion on a dark, luxurious palette.",
  thermal: "An infrared camera view: ironbow heat-map colours glowing on dark, like looking through a thermal scope at the work.",
  starlight: "Night-vision goggles: green phosphor glow, starfield grain and scanlines on black. Stealthy and atmospheric.",
  tracker: "A computer-vision model watching the page: bounding boxes, detection labels and tracking overlays on a light, lab-like canvas.",
  foil: "A holographic trading card under tilted light: iridescent foil that shifts colour with your cursor, pearl and rainbow sheens on dark.",
  flux: "Particle clouds you can stir: a swarm of glowing dust and nebula on deep night blue that swirls around your pointer.",
  lucid: "Liquid glass over moving light: frosted, refracting glass panels with lit rims floating over soft violet and coral light.",
  clay: "Warm paper, clay and ink: terracotta and cream tones with watercolour washes and hand-inked details. Calm and crafted.",
  lumen: "Soft light on black, precise: glowing gradient meshes and crisp type on pure dark. Sleek and modern.",
  blueprint: "A drawing set inked live: cyanotype blue with technical drafting lines and annotations that draw in as you scroll.",
  corsa: "Rosso corsa in a night garage: a 3D race car under moody lights, deep reds and motorsport detailing.",
};

/** The agent's "Looks" section: every design with its description, then the colour palettes by name. */
export function looksPrompt(looks: { id: string; name: string }[]): string {
  const designs = looks.filter((l) => DESIGN_ABOUT[l.id]).map((l) => `- ${l.name} (${l.id}): ${DESIGN_ABOUT[l.id]}`);
  const palettes = looks.filter((l) => !DESIGN_ABOUT[l.id]).map((l) => l.name);
  return `${designs.join("\n")}${palettes.length ? `\nColour palettes (the plain Classic layout in different colours): ${palettes.join(", ")}.` : ""}`;
}
