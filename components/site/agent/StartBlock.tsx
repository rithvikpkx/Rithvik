import { version } from "@/package.json";
import { AGENT_EFFORT } from "@/lib/agent/status";

/** The ouroboros as a hand-built 11x11 pixel grid (X = lit, o = the eye): a ring that thickens toward the head and bites its tail. */
const GRID = [
  "...XXXX....",
  "..XX....XX.",
  ".XX.....XoX",
  "XX......XXX",
  "X........XX",
  "X........XX",
  "X........XX",
  "XX......XX.",
  ".XX....XX..",
  "..XX..XX...",
  "...XXXX....",
];
const PIXELS = GRID.flatMap((row, y) => [...row].flatMap((c, x) => (c === "X" ? [[x, y] as const] : [])));

/** The chat's opening block, laid out like Claude Code's: logo, name and version, model and effort, tagline, then a dim hint. */
export default function StartBlock({ model, projects, roles }: { model?: string; projects: number; roles: number }) {
  return (
    <div className="agent-start">
      <svg className="as-logo" viewBox={`0 0 ${GRID[0].length} ${GRID.length}`} aria-hidden="true" shapeRendering="crispEdges">
        {PIXELS.map(([x, y], i) => <rect key={i} x={x} y={y} width="1" height="1" style={{ "--i": x + y } as React.CSSProperties} />)}
      </svg>
      <div className="as-text">
        <p className="as-name"><b>RAG</b> <span>v{version}</span></p>
        <p>{model ? `${model} with ${AGENT_EFFORT} effort · ` : ""}Rithvik Augmented Generation</p>
        <p>Rithvik&apos;s own agent · grounded in {projects} projects + {roles} roles</p>
      </div>
      <p className="as-hint">/help for commands · ⌘K to toggle · esc to interrupt</p>
    </div>
  );
}
