import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Grove: the nature element. Under a forest canopy: leaves hanging in from the edges and swaying in the wind, sun
// breaking through in shafts and soft discs, pollen drifting; the pointer is a patch of sunlight the leaves part
// around, its speed is the wind,
// a press is a gust that throws the canopy open in a ring.
export const META: DesignMeta = {
  id: "grove", name: "Grove", mood: "a canopy in the wind", dark: true,
  keywords: ["grove","nature","forest","leaves","leaf","moss","vines","garden","plants","trees","wind","elemental","ninja","botanical"],
  swatch: ["#0C1610","#EEF3E2","#8FD16A","#F2B6C6"],
  cardFont: "\"Caprasimo\", Georgia, serif",
  fonts: "family=Caprasimo&family=Figtree:ital,wght@0,400..700;1,400&family=Fragment+Mono",
  shader: {
    colors: ["#07100B","#1F3D22","#6FB24E","#F4F0B8"], scale: 0.5, host: "#gv-gl",
    source: EL_GLSL + `
// one pointed leaf in its own frame (x along the blade, half-length L, half-width W): coverage, and the midrib line
vec2 leaf(vec2 q, float L, float W, float px){
  float u = clamp(q.x / L, -1., 1.);
  float w = W * pow(max(1. - u * u, 0.), .75);
  float m = smoothstep(px, -px, abs(q.y) - w) * step(abs(q.x), L);
  return vec2(m, smoothstep(px * 1.5, 0., abs(q.y)) * m * (1. - abs(u)));
}
// a layer of leaves on a jittered grid (each cell's leaf may reach into its neighbours, so look at all 9): swaying
// with the wind, only where dens allows. x = coverage, y = lit edge toward the sun, z = midrib, w = shade variation
vec4 leaves(vec2 p, float sc, float t, float wind, float seed, vec2 sunDir, float px, vec2 frame){
  vec2 g = p * sc, c = floor(g);
  vec4 o = vec4(0.);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 id = c + vec2(float(i), float(j));
    float h = hash21(id + seed), h2 = hash21(id + seed + 9.1);
    vec2 ctr = id + .5 + (vec2(h, h2) - .5) * .5; // jitter and reach (below) stay inside the 3x3 neighbourhood
    vec2 wp = ctr / sc;
    // the canopy hangs in from the top and the right; the copy column stays open
    float dens = smoothstep(.55, 1.05, dot(wp, frame));
    if (hash21(id + seed + 4.4) > dens) continue;
    float ang = h * 6.2832 + sin(t * (.6 + h) + h * 20.) * .12 * wind;
    vec2 d = g - ctr;
    vec2 q = vec2(cos(ang) * d.x + sin(ang) * d.y, -sin(ang) * d.x + cos(ang) * d.y);
    q.x += .38; // the stem end sits at the cell centre, the blade reaches out
    vec2 lf = leaf(q, .38 + .14 * h2, .14 + .05 * h, px * sc);
    float lit = clamp(dot(normalize(vec2(cos(ang), sin(ang))), sunDir) * .5 + .5, 0., 1.);
    if (lf.x > o.x) o = vec4(lf.x, lit, lf.y, h2);
  }
  return o;
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float ch = u_charge;
  float low = smoothstep(.82, .97, u_scroll); // Contact: under the ferns, the light lower and greener
  float wind = 1. + 4. * ch;
  float px = 1.5 / u_res.y;

  // the leaves part around the pointer (a patch of sun) and blow open in a ring after a gust
  vec2 dm = p - m; float r2 = dot(dm, dm);
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  float gust = elRing(p, bc, u_burst.z, .8, .14);
  vec2 q = p + dm * exp(-r2 * 10.) * .3 * act + normalize(p - bc + 1e-4) * gust * .08;

  // deep forest light: dark below, a warm haze high on the sun side, out-of-focus sun discs drifting behind the leaves
  vec2 sun = vec2(asp * .86, 1.05);
  float sd = length(p - sun);
  vec3 col = mix(u_c0, u_c1 * .8, smoothstep(.0, 1., uv.y) * .7);
  col += u_c3 * .22 * exp(-sd * 1.8) * (1. - .6 * low);
  float bok = elMotes(p, t * .3, 4.5, vec2(.05 * wind, .02), .38, .3);
  col += mix(u_c2, u_c3, .5) * bok * .12 * smoothstep(.2, 1., uv.y);

  // shafts of sun slanting down from the canopy
  float shaft = pow(.5 + .5 * sin((p.x - p.y * .5) * 7. + fbm(vec2(p.x * 1.2, t * .04)) * 2.), 7.);
  col += u_c3 * shaft * .07 * smoothstep(.1, 1., uv.y) * (1. - low * .6);

  // two depths of leaves: far ones small and soft, near ones large and dark with a lit edge facing the sun
  vec2 sdir = normalize(sun - p);
  vec2 frameF = wide > .5 ? vec2(.72 / asp, .6) : vec2(.3 / asp, .95); // weights of x and y in where leaves grow
  vec4 lf1 = leaves(q + vec2(t * .004 * wind, 0.), 5., t, wind, 3.7, sdir, px * 2., frameF * 1.12);
  col = mix(col, mix(u_c1, u_c2, .35 + .3 * lf1.w) * (.55 + .5 * lf1.y), lf1.x * .85);
  vec4 lf2 = leaves(q, 2.6, t * 1.2, wind * 1.3, 11.3, sdir, px, frameF);
  vec3 near = mix(u_c0 * 1.6, u_c1 * 1.3, lf2.w * .6) + u_c2 * .55 * pow(lf2.y, 3.) + u_c3 * .12 * pow(lf2.y, 8.);
  near *= 1. - .35 * lf2.z;
  col = mix(col, near, lf2.x);

  // the pointer's warm patch of light, and the gust's flash of sun
  col += u_c3 * exp(-r2 * 24.) * .16 * act + u_c3 * gust * .25;

  // pollen and seeds drifting in the light, faster with the wind
  float po = elMotes(p, t, 20., vec2(.16 * wind, .06), .1, .1);
  float po2 = elMotes(p + 5., t, 38., vec2(.26 * wind, .1), .12, .08);
  col += u_c3 * (po + po2 * .7) * .5 * smoothstep(0., .6, uv.y);

  col = mix(col, u_c0, low * .3);
  col *= 1. - .45 * pow(length((uv - .5) * vec2(1., 1.15)), 2.4);
  col += elGrain(fc, t) * .025;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/grove"),
};
