import type { ShaderSpec } from "@/lib/designs/types";
import { GLSL_HEAD } from "./head";
import { createScaleController, hexToVec3, pointBudget, pointSeeds } from "./helpers";

/** A per-design uniform value: float/int/bool as a number, vec2..vec4 as an array. */
export type UniformValue = number | [number, number] | [number, number, number] | [number, number, number, number];

const VS = "attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }";
const HEAD_LINES = GLSL_HEAD.split("\n").length - 1; // so error lines point into the design's own source
const BUILTINS = ["u_res", "u_time", "u_mouse", "u_scroll", "u_dark", "u_px", "u_c0", "u_c1", "u_c2", "u_c3"];

type Active = { loc: WebGLUniformLocation; type: number };

// One canvas and one GL context for the whole page; a design switch only swaps programs.
let canvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let vb: WebGLBuffer | null = null;
let prog: WebGLProgram | null = null;
let U: Record<string, Active> = {};
// the optional particle pass (spec.points): its own program, uniforms and seed buffer, same context
let pp: WebGLProgram | null = null, sb: WebGLBuffer | null = null, pCount = 0;
let PU: Record<string, Active> = {};
const user = new Map<string, UniformValue>(); // per-design uniforms; cleared on program swap
let current: { spec: ShaderSpec; dark: boolean } | null = null;
let cols: [number, number, number][] = [];
let lost = false, visible = true, raf = 0, last = 0, tPrev = 0;
let t0 = 0, mouse = [0.5, 0.5], mouseS = [0.5, 0.5];
const scale = createScaleController(0.5);
let cleanup: (() => void)[] = [];

/** True when the page asked for calm: reduced motion or performance mode (`html.lite`). */
function isStill() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("lite");
}

/** Maps a GL error log's line numbers onto the design's source (head lines are subtracted). */
export function readableLog(log: string | null): string {
  return (log ?? "").replace(/(ERROR|WARNING): (\d+):(\d+):/g, (_, k, _f, l) => `${k} line ${Number(l) - HEAD_LINES}:`).trim();
}

/** Creates the shared canvas and context on first use; false (and `html.no-gl`) when WebGL is missing. */
function ensure(): boolean {
  if (gl) return !lost;
  canvas = document.createElement("canvas");
  canvas.className = "gl";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { display: "block", position: "absolute", inset: "0", width: "100%", height: "100%" });
  gl = canvas.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
  if (!gl) { canvas = null; document.documentElement.classList.add("no-gl"); return false; }
  initBuffer();
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; cancelAnimationFrame(raf); raf = 0; drop(); });
  canvas.addEventListener("webglcontextrestored", () => {
    lost = false; initBuffer();
    if (current && link(current.spec)) kick(); // user uniforms survive: same names, new locations
  });
  return true;
}

/** (Re)creates the fullscreen-triangle vertex buffer (after creation or a context restore). */
function initBuffer() {
  const g = gl!;
  vb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, vb);
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
}

/** Compiles one shader stage; logs a readable error and returns null on failure. */
function compile(type: number, src: string, label: string): WebGLShader | null {
  const g = gl!, s = g.createShader(type)!;
  g.shaderSource(s, src); g.compileShader(s);
  if (g.getShaderParameter(s, g.COMPILE_STATUS)) return s;
  console.warn(`[shader] ${label} compile failed\n${readableLog(g.getShaderInfoLog(s))}`);
  g.deleteShader(s);
  return null;
}

/** Links a vertex + fragment pair with the attribute pinned to location 0 (both passes share it); null on failure. */
function program(vs: string, fs: string, attr: string, label: string): WebGLProgram | null {
  const g = gl!;
  const v = compile(g.VERTEX_SHADER, vs, `${label} vertex`), f = compile(g.FRAGMENT_SHADER, fs, `${label} fragment`);
  if (!v || !f) { if (v) g.deleteShader(v); if (f) g.deleteShader(f); return null; }
  const p = g.createProgram()!;
  g.attachShader(p, v); g.attachShader(p, f); g.bindAttribLocation(p, 0, attr); g.linkProgram(p);
  g.deleteShader(v); g.deleteShader(f);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) { console.warn(`[shader] ${label} link failed\n${readableLog(g.getProgramInfoLog(p))}`); g.deleteProgram(p); return null; }
  return p;
}

/** A program's active uniforms by name, with types from the link so setUniform can validate. */
function uniformsOf(p: WebGLProgram): Record<string, Active> {
  const g = gl!, out: Record<string, Active> = {};
  for (let i = 0, n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS) as number; i < n; i++) {
    const a = g.getActiveUniform(p, i);
    const loc = a && g.getUniformLocation(p, a.name);
    if (a && loc) out[a.name] = { loc, type: a.type };
  }
  return out;
}

/** Deletes the background program and the particle pass (program + seed buffer). */
function drop() {
  const g = gl;
  if (g && !lost) { if (prog) g.deleteProgram(prog); if (pp) g.deleteProgram(pp); if (sb) g.deleteBuffer(sb); }
  prog = pp = sb = null; U = {}; PU = {}; pCount = 0;
}

/** Builds the background program for a spec (and its particle pass, if any), introspecting their uniforms. A broken
 *  particle pass only warns: the background still runs. */
function link(spec: ShaderSpec): boolean {
  const g = gl!;
  drop();
  const p = program(VS, GLSL_HEAD + spec.source, "p", "background");
  if (!p) return false;
  prog = p; U = uniformsOf(p);
  if (spec.points) {
    const q = program(GLSL_HEAD + spec.points.vertex, GLSL_HEAD + spec.points.fragment, "a_seed", "points");
    if (q) {
      pp = q; PU = uniformsOf(q); pCount = spec.points.count;
      sb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, sb);
      g.bufferData(g.ARRAY_BUFFER, pointSeeds(pCount), g.STATIC_DRAW);
    }
  }
  g.enableVertexAttribArray(0);
  cols = spec.colors.map(hexToVec3);
  return true;
}

/** Number of floats a GL uniform type takes (0 = unsupported, e.g. matrices and samplers). */
function arity(type: number): number {
  const g = gl!;
  return ({ [g.FLOAT]: 1, [g.INT]: 1, [g.BOOL]: 1, [g.FLOAT_VEC2]: 2, [g.FLOAT_VEC3]: 3, [g.FLOAT_VEC4]: 4 } as Record<number, number>)[type] ?? 0;
}

/** Uploads one uniform value according to its GL type. */
function upload(a: Active, v: UniformValue) {
  const g = gl!, x = typeof v === "number" ? [v] : v;
  if (a.type === g.INT || a.type === g.BOOL) g.uniform1i(a.loc, x[0]);
  else if (x.length === 1) g.uniform1f(a.loc, x[0]);
  else if (x.length === 2) g.uniform2fv(a.loc, x);
  else if (x.length === 3) g.uniform3fv(a.loc, x);
  else g.uniform4fv(a.loc, x);
}

/** Sizes the drawing buffer to canvas CSS size × capped DPR × adaptive scale. */
function size() {
  const c = canvas!, r = c.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(2, Math.round(r.width * dpr * scale.scale)), h = Math.max(2, Math.round(r.height * dpr * scale.scale));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl!.viewport(0, 0, w, h); }
}

/** Draws one frame: the background triangle (built-ins, then the design's own uniforms), then the particle pass with
 *  additive blending, its count trimmed by screen size and the adaptive scale. */
function draw(now: number) {
  const g = gl!;
  if (!prog) return;
  size();
  // frame-rate independent smoothing (0.06 per 60Hz frame, like the mockup)
  const k = 1 - Math.pow(0.94, Math.min(4, tPrev ? (now - tPrev) / 16.667 : 1)); tPrev = now;
  mouseS = [mouseS[0] + (mouse[0] - mouseS[0]) * k, mouseS[1] + (mouse[1] - mouseS[1]) * k];
  const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  const css = canvas!.getBoundingClientRect();
  const builtins = (M: Record<string, Active>) => {
    const set = (n: string, f: (l: WebGLUniformLocation) => void) => { if (M[n]) f(M[n].loc); };
    set("u_res", (l) => g.uniform2f(l, canvas!.width, canvas!.height));
    set("u_time", (l) => g.uniform1f(l, (now - t0) / 1000));
    set("u_mouse", (l) => g.uniform2f(l, mouseS[0], mouseS[1]));
    set("u_scroll", (l) => g.uniform1f(l, Math.min(1, scrollY / max)));
    set("u_dark", (l) => g.uniform1f(l, current?.dark ? 1 : 0));
    set("u_px", (l) => g.uniform1f(l, canvas!.width / Math.max(1, css.width)));
    cols.forEach((c, i) => set(`u_c${i}`, (l) => g.uniform3fv(l, c)));
    user.forEach((v, n) => M[n] && upload(M[n], v));
  };
  g.useProgram(prog); builtins(U);
  g.bindBuffer(g.ARRAY_BUFFER, vb); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
  g.drawArrays(g.TRIANGLES, 0, 3);
  if (!pp || !sb || !current) return;
  g.useProgram(pp); builtins(PU);
  g.bindBuffer(g.ARRAY_BUFFER, sb); g.vertexAttribPointer(0, 4, g.FLOAT, false, 0, 0);
  g.enable(g.BLEND); g.blendFuncSeparate(g.SRC_ALPHA, g.ONE, g.ZERO, g.ONE); // additive light, destination alpha kept
  g.drawArrays(g.POINTS, 0, pointBudget(pCount, css.width * css.height, scale.scale, current.spec.scale));
  g.disable(g.BLEND);
}

/** One rAF step: a single still frame when calm, otherwise a frame plus the adaptive-resolution check. */
function frame(now: number) {
  raf = 0;
  if (!prog || lost || !visible || document.hidden) return; // paused: kick() restarts it
  if (isStill()) { draw(now); return; }
  if (last) scale.push(now - last);
  last = now; draw(now);
  raf = requestAnimationFrame(frame);
}

/** (Re)starts rendering if it is idle: continues the loop, or draws one still frame when calm. */
export function kick() {
  if (!prog || lost || raf) return;
  last = 0; tPrev = 0;
  raf = requestAnimationFrame(frame);
}

/** True while frames are actually being produced (visible, tab shown, not calm). */
export function isAnimating() {
  return !!prog && !lost && visible && !document.hidden && !isStill();
}

/** Current adaptive render scale (for debugging and the watchdog). */
export function getScale() { return scale.scale; }

/** Seconds on the clock the shader sees as `u_time` (for designs that stamp events, like a gust's start). */
export function shaderTime() { return (performance.now() - t0) / 1000; }

/** Sets a per-design uniform; it persists every frame until the next mount() swaps programs.
 *  Returns false (and warns) for an unknown name, a built-in, or a value of the wrong size. */
export function setUniform(name: string, value: UniformValue): boolean {
  const a = U[name] ?? PU[name], n = typeof value === "number" ? 1 : value.length; // either pass may declare it
  if (!gl || !prog || !a || BUILTINS.includes(name) || arity(a.type) !== n) {
    console.warn(`[shader] setUniform("${name}") ignored: ${!a ? "no such active uniform" : BUILTINS.includes(name) ? "built-in" : "wrong value size"}`);
    return false;
  }
  user.set(name, value);
  kick(); // calm mode draws no loop, so ask for one fresh still
  return true;
}

/** Updates u_dark without relinking. */
export function setDark(dark: boolean) {
  if (current) { current.dark = dark; kick(); }
}

/** Puts the shared canvas into `host` running `spec`: swaps the program (clearing per-design
 *  uniforms), then applies `uniforms`. Returns false if WebGL or the shader is unavailable. */
export function mount(host: HTMLElement, spec: ShaderSpec, dark: boolean, uniforms?: Record<string, UniformValue>): boolean {
  if (!ensure()) return false;
  unmount();
  current = { spec, dark };
  if (!link(spec)) { current = null; return false; }
  scale.reset(spec.scale); t0 = performance.now(); visible = true;
  host.appendChild(canvas!);

  const c = canvas!, html = document.documentElement, mq = matchMedia("(prefers-reduced-motion: reduce)");
  const onMove = (e: PointerEvent) => {
    const r = c.getBoundingClientRect();
    if (r.width) mouse = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };
  const io = new IntersectionObserver((en) => { visible = en[0].isIntersecting; kick(); });
  const ro = new ResizeObserver(kick); // a calm still must redraw after a resize clears the buffer
  const mo = new MutationObserver(kick); // `html.lite` toggled
  io.observe(c); ro.observe(c); mo.observe(html, { attributes: true, attributeFilter: ["class"] });
  addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("visibilitychange", kick);
  mq.addEventListener("change", kick);
  cleanup = [
    () => { io.disconnect(); ro.disconnect(); mo.disconnect(); },
    () => removeEventListener("pointermove", onMove),
    () => document.removeEventListener("visibilitychange", kick),
    () => mq.removeEventListener("change", kick),
  ];
  for (const [n, v] of Object.entries(uniforms ?? {})) setUniform(n, v);
  kick();
  return true;
}

/** Detaches the canvas, drops the program, stops the loop and removes every listener. The GL context
 *  itself is kept for the next mount. */
export function unmount() {
  cleanup.forEach((f) => f()); cleanup = [];
  cancelAnimationFrame(raf); raf = 0;
  drop();
  user.clear(); current = null;
  canvas?.remove();
}
