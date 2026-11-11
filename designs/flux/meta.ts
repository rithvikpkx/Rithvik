import type { DesignMeta } from "../../lib/designs/types.ts";

// Flux: abstract clouds of light, tens of thousands of points the visitor can push, stir, scatter and gather. Every
// point is computed in the vertex shader from four fixed randoms and the clock (no simulation state), so the GPU
// does all the work and there is nothing to keep in sync. Inertia comes from the uniforms: a lagging pointer that
// each point follows at its own delay, and gusts whose displacement is a damped oscillation (out, a little back,
// settled). Coordinates are "view units": y spans -1..1 over the viewport height, x spans -aspect..aspect.

/** The background: near-black space with a faint nebular glow round the anchor (portrait or contact cloud). */
const BACKGROUND = `uniform vec4 u_a;
void main(){
  vec2 uv = gl_FragCoord.xy / u_res; float asp = u_res.x / u_res.y;
  vec2 p = (uv * 2. - 1.) * vec2(asp, 1.);
  float t = u_time * .018;
  float n = snoise(p * .65 + vec2(t, -t * .6)) * .6 + snoise(p * 1.7 - vec2(t * 1.3, t)) * .3;
  float g = exp(-length((p - u_a.xy) * vec2(.75, 1.)) * 1.5);
  vec3 c = u_c0;
  c += u_c2 * .08 * g + mix(u_c2, u_c1, .5 + .5 * n) * .03 * smoothstep(-.2, .9, n);
  c *= 1. - .55 * dot(uv - .5, uv - .5);
  gl_FragColor = vec4(c, 1.);
}`;

/** One point. Three populations by a_seed.x: a halo round the anchor, a nebula of three lobes swept into filaments,
 *  and sparse out-of-focus dust. Then a slow camera, the pointer, gusts, the name swarm and the scroll wind. */
const VERTEX = `attribute vec4 a_seed;
uniform vec4 u_a; // anchor centre (view), radius, unused
uniform vec4 u_p; // pointer position, velocity (view units / s)
uniform vec4 u_q; // lagging pointer position, hold 0-1, presence 0-1
uniform vec4 u_n; // name box centre, half size (view)
uniform vec4 u_k; // name energy, scroll wind (view / s), intro 0-1, unused
uniform vec4 u_g0; uniform vec4 u_g1; uniform vec4 u_g2; uniform vec4 u_g3; uniform vec4 u_g4; uniform vec4 u_g5; // x, y, start, kind
varying vec4 v_c; varying float v_h;

vec3 flow(vec3 p, float t){
  return vec3(sin(p.y * 1.9 + t * .31) + .6 * sin(p.z * 3.1 - t * .23),
              sin(p.z * 1.7 - t * .27) + .6 * sin(p.x * 2.9 + t * .19),
              sin(p.x * 2.3 + t * .21) + .6 * sin(p.y * 2.6 - t * .29));
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
// a gust: a shock front runs out from (x, y); each point it reaches swings out, comes a little back and settles
vec2 gust(vec4 g, vec2 s, float t){
  float age = t - g.z;
  if (age < 0. || age > 4.) return vec2(0.);
  vec2 d = s - g.xy; float r = length(d) + 1e-3;
  float tau = age - r * .5;
  if (tau <= 0.) return vec2(0.);
  float h = sin(tau * 5.2) * exp(-tau * 2.1), A = exp(-r * 2.4);
  if (g.w < .5) return d / r * .3 * A * h; // burst
  if (g.w < 1.5) return -d / r * min(.34 * A, r * .9) * h; // implosion
  vec2 dir = vec2(cos(g.w - 2.), sin(g.w - 2.)); // a stroke: pushed along it and curled round it
  return (dir * .2 + vec2(-d.y, d.x) * 1.6) * exp(-r * r * 26.) * h;
}

void main(){
  float asp = u_res.x / u_res.y, t = u_time;
  vec4 s = a_seed;
  float s4 = fract(s.y * 7.31 + s.z * 3.17), s5 = fract(s.z * 5.13 + s.w * 9.71), s6 = fract(s.w * 3.71 + s.x * 13.3);
  float g1 = sqrt(-2. * log(max(s4, 1e-4)));
  vec3 gs = vec3(g1 * cos(6.2832 * s5), g1 * sin(6.2832 * s5), sqrt(-2. * log(max(s6, 1e-4))) * cos(6.2832 * s.w));
  vec2 A = u_a.xy; float R = max(u_a.z, .05);
  float wide = clamp(asp / 1.6, .3, 1.);
  vec3 P, col; float size, alpha, hard = 0.;
  if (s.x < .46) {
    // halo: a thick tilted disc spinning round the anchor, inner orbits faster
    float u = s.y, rr = R * (1.1 + 1.15 * u * u + .05 * gs.x);
    float a = s.z * 6.2832 + t * .2 / pow(rr / R, 1.5);
    vec3 q = vec3(cos(a) * rr, gs.y * R * (.03 + .1 * u), sin(a) * rr);
    q.yz = rot(1.12) * q.yz; q.xy = rot(-.42) * q.xy;
    q += flow(q * 3. / R + s.x * 9., t * .35) * R * .05 * (.3 + u);
    P = vec3(A, 0.) + q;
    col = mix(u_c1, u_c2, smoothstep(.05, .85, u));
    size = 1.3 + 1.5 * s6 * s6 * s6; alpha = .5 - .26 * u;
  } else if (s.x < .9) {
    // nebula: three lobes, sheared by differential rotation and swept into filaments by the flow
    float l = floor(s.y * 3.);
    vec2 c = l < .5 ? vec2(-1.5 * wide, -.42) : l < 1.5 ? vec2(.1 * wide, -.7) : vec2(-.62 * wide, .6);
    vec3 sg = l < .5 ? vec3(.62 * wide + .1, .2, .4) : l < 1.5 ? vec3(.55 * wide, .15, .3) : vec3(.42 * wide, .13, .3);
    vec3 o = gs * sg;
    o.xy = rot((l - 1.) * .45 + t * .03 / (.3 + length(o.xy))) * o.xy;
    P = vec3(A + c, -.25 - .3 * l) + o;
    P += flow(P * 1.6 + l * 7., t * .12) * .15;
    P += flow(P * 3.4 + 3., t * .2) * .045;
    col = mix(u_c2, u_c1, clamp(.5 + o.x * .9 + (l - 1.) * .25, 0., 1.));
    if (s6 > .965) col = u_c3; // embers
    size = 1. + 1.3 * s5 * s5 + (s6 > .965 ? .8 : 0.); alpha = s6 > .965 ? .55 : .26;
  } else {
    // dust: sparse motes out of focus, drifting up through the whole view
    P = vec3((s.y * 2. - 1.) * asp * 1.15, mod(s.z * 2.6 + t * .014 * (.5 + s6), 2.6) - 1.3, -2.4 + s.w * 3.2);
    col = mix(u_c1, u_c2, s4);
    size = 2. + 7. * s6 * s6; alpha = .07; hard = 1.;
  }
  // camera: a slow sway plus parallax toward the lagging pointer, rotating about the anchor
  vec3 pc = P - vec3(A, 0.);
  pc.xz = rot(.12 * sin(t * .05) + (u_q.x - A.x) * .05) * pc.xz;
  pc.yz = rot((u_q.y - A.y) * .04) * pc.yz;
  P = pc + vec3(A, 0.);
  float w = 3.2 / (3.2 - clamp(P.z, -6., 2.4));
  vec2 S = P.xy * w;
  // intro: the cloud condenses out of a wide scatter
  float ik = u_k.z * u_k.z * (3. - 2. * u_k.z);
  S = mix(S * 1.8 + gs.xy * .5, S, clamp(ik * 1.4 - s6 * .4, 0., 1.));
  vec2 S0 = S;
  // the pointer: each point follows its own blend of the live and the lagging pointer, so the cloud trails and settles
  float lag = s6;
  vec2 m = mix(u_p.xy, u_q.xy, .3 + lag * .7);
  vec2 d = S - m; float r2 = dot(d, d) + 1e-4;
  float pres = u_q.w;
  S += d * inversesqrt(r2) * .09 * exp(-r2 * 20.) * pres * (1. - u_q.z); // a hollow opens under the pointer
  S += u_p.zw * .05 * exp(-r2 * 7.) * (1. - lag * .7) * pres; // the wake drags along
  // hold: an implosion, a spinning knot under the pointer
  float H = u_q.z * exp(-r2 * 1.6) * (.45 + .55 * s5);
  vec2 dk = rot(u_q.z * 3. * (1. - lag) + t * 1.5) * d;
  S = mix(S, m + dk * .16, H);
  S += gust(u_g0, S0, t) + gust(u_g1, S0, t) + gust(u_g2, S0, t) + gust(u_g3, S0, t) + gust(u_g4, S0, t) + gust(u_g5, S0, t);
  // the name: a share of the nebula swarms into the name's box, each point at its own delay
  float sel = step(.46, s.x) * step(s.x, .9) * step(s5, .42);
  float kk = clamp(u_k.x * 1.7 - s6 * .7, 0., 1.); kk = kk * kk * (3. - 2. * kk);
  vec2 tgt = u_n.xy + clamp(gs.xy * .42, -1., 1.) * u_n.zw + flow(vec3(gs.xy * 4., s.x * 9.), t * .9).xy * .006;
  S = mix(S, tgt, kk * sel * step(.001, u_n.z));
  // scroll wind: points lag behind the page a little, farther ones more
  S.y += clamp(u_k.y, -4., 4.) * .03 * (.4 + lag) * (2. - w);
  float e = length(S - S0) + kk * sel * .15; // displaced points heat up
  col = mix(col, mix(vec3(1.), u_c3, .45), clamp(e * 3.5, 0., .75));
  float blur = abs(P.z) * .8; // depth of field: focus on the anchor plane
  size = (size + blur * 2.6) * w * (1. + clamp(e * 2., 0., 1.));
  alpha *= (1. + clamp(e * 3., 0., 1.5)) / (1. + blur * blur * 1.6);
  alpha *= .35 + .65 * ik;
  gl_PointSize = clamp(size * u_px, 1., 48.);
  gl_Position = vec4(S.x / asp, S.y, 0., 1.);
  v_c = vec4(col, alpha); v_h = hard;
}`;

/** A soft glowing dot (gaussian), or a flat disc with a lit rim for out-of-focus dust. */
const FRAGMENT = `varying vec4 v_c; varying float v_h;
void main(){
  vec2 d = gl_PointCoord * 2. - 1.; float r2 = dot(d, d);
  if (r2 > 1.) discard;
  float a = mix(exp(-r2 * 3.4) - .03, smoothstep(1., .7, r2) * (.7 + .3 * r2), v_h);
  gl_FragColor = vec4(v_c.rgb, v_c.a * a);
}`;

export const META: DesignMeta = {
  id: "flux", name: "Flux", mood: "particle clouds you can stir", dark: true,
  keywords: ["flux", "particle", "particles", "cloud", "clouds", "swarm", "nebula", "dust", "points", "flow", "stars", "galaxy", "interactive", "dark"],
  swatch: ["#05060C", "#8EE6FF", "#A98BFF", "#FF9A6A"],
  cardFont: "\"Syne\", \"Helvetica Neue\", sans-serif",
  fonts: "family=Syne:wght@400..800&family=Manrope:wght@300..700&family=Geist+Mono:wght@400..600",
  shader: {
    colors: ["#05060C", "#8EE6FF", "#A98BFF", "#FF9A6A"], scale: 0.6, host: "#fl-gl",
    source: BACKGROUND,
    points: { count: 64000, vertex: VERTEX, fragment: FRAGMENT },
  },
  load: () => import("@/designs/flux"),
};
