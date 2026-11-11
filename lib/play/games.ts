/** Play window catalogue, ported from the v7 mockup's PLAY + GAMES. `base` is Rithvik's own score. */
export type Game = { id: string; name: string; desc: string; unit: string; base: number; hi: boolean };
export type PlayEntry = { id: string; name: string; desc: string; icon: string };

export const GAMES: Game[] = [
  { id: "typeracer", name: "Type Racer", desc: "Type a real line from my projects", unit: "WPM", base: 96, hi: true },
  { id: "angle", name: "Angle Approximator", desc: "Guess the angle in degrees", unit: "° off", base: 4.2, hi: false },
  { id: "dots", name: "Count the Dots", desc: "Dots flash for under a second", unit: "% off", base: 8, hi: false },
  { id: "center", name: "Center the Div", desc: "Drag the box to the exact centre", unit: "px off", base: 3, hi: false },
];

const GAME_ICONS: Record<string, string> = { typeracer: "keyboard", angle: "drafting-compass", dots: "grip", center: "crosshair" };

export const PLAY: PlayEntry[] = [
  { id: "records", name: "Deck", desc: "Play a 1927 record through knobs and a scope", icon: "music" },
  { id: "artboard", name: "Artboard", desc: "Sketch and diagram, then export", icon: "palette" },
  ...GAMES.map((g) => ({ id: g.id, name: g.name, desc: g.desc, icon: GAME_ICONS[g.id] })),
  { id: "darkroom", name: "Darkroom", desc: "29 image effects on my portrait, as a constellation", icon: "share-2" },
];
