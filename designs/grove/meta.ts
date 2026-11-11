import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Grove: the nature element. Under a forest canopy: layered leaves swaying in the wind, sun breaking through in shafts
// and dapples, pollen drifting; the pointer is a patch of sunlight the leaves part around, its speed is the wind,
// a press is a gust that throws the canopy open in a ring.
export const META: DesignMeta = {
  id: "grove", name: "Grove", mood: "a canopy in the wind", dark: true,
  keywords: ["grove","nature","forest","leaves","leaf","moss","vines","green","garden","plants","trees","wind","elemental","ninja","botanical"],
  swatch: ["#0C1610","#EEF3E2","#8FD16A","#F2B6C6"],
  cardFont: "\"Caprasimo\", Georgia, serif",
  fonts: "family=Caprasimo&family=Figtree:ital,wght@0,400..700;1,400&family=Fragment+Mono",
  shader: {
    colors: ["#07100B","#1F3D22","#6FB24E","#F4F0B8"], scale: 0.5, host: "#gv-gl",
    source: EL_GLSL + `
// one layer of canopy: leaf clumps (noise), each leaf edge sharpened, swaying with the wind; returns leaf cover 0..1
float canopy(vec2 p, float t, float wind, float sc, float seed){
  vec2 sway = vec2(sin(t * .9 + p.y * 2. + seed) , cos(t * .7 + p.x * 1.6 + seed)) * .02 * wind;
  vec2 q = p * sc + sway * sc + seed;
  float n = fbm(q) + .35 * snoise(q * 3.1 + seed);
  return smoothstep(-.02, .14, n);
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float ch = u_charge;
  float floorView = smoothstep(.82, .97, u_scroll); // Contact: lower, darker, under the ferns
  float wind = 1. + 3.5 * ch;

  // the leaves part around the pointer (a sun patch) and blow open in a ring after a gust
  vec2 dm = p - m; float r2 = dot(dm, dm);
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  vec2 db = p - bc;
  float gust = elRing(p, bc, u_burst.z, .8, .14);
  vec2 q = p + dm * exp(-r2 * 9.) * .35 * act + normalize(db + 1e-4) * gust * .09;

  // sky behind the canopy: warm light, brightest top right where the sun is
  vec2 sun = vec2(asp * .82, 1.02);
  float sd = length(p - sun);
  vec3 sky = mix(u_c3 * .9, u_c2 * .55, smoothstep(.0, .9, sd));
  // three depths of leaves: far (pale, soft), mid (green), near (dark silhouettes with lit rims)
  float far = canopy(q, t, wind, 2.2, 1.7);
  float mid = canopy(q + vec2(.3, 0.), t * 1.2, wind, 3.4, 6.1);
  float nearC = canopy(q * 1.1 + vec2(0., .2), t * 1.4, wind * 1.3, 4.8, 11.3);
  vec3 col = sky;
  col = mix(col, mix(u_c2, u_c1, .35) * .9, far * .85);
  col = mix(col, u_c1 * 1.1, mid);
  float rim = smoothstep(.0, .5, nearC) * (1. - smoothstep(.5, 1., nearC));
  col = mix(col, u_c0 * 1.4, nearC);
  col += u_c2 * rim * .25 * (1. - smoothstep(.2, 1.2, sd));
  // the canopy thickens downward into the forest floor; Contact sits lower, under the ferns
  col = mix(col, u_c0, smoothstep(.55, -.1, uv.y + .2 * fbm(p * 2.)) * (.85 + .15 * floorView));
  col = mix(col, u_c0 * 1.2, floorView * .45);

  // sun shafts slanting through the gaps, and the pointer's warm patch of light
  float gap = 1. - max(mid, nearC);
  float shaft = pow(.5 + .5 * sin((p.x - p.y * .55) * 9. + fbm(p * 1.5 + t * .05) * 2.), 6.);
  col += u_c3 * shaft * gap * .16 * (1. - floorView * .6);
  col += u_c3 * exp(-r2 * 26.) * .22 * act * (1. - nearC * .7);
  col += u_c3 * gust * .3;

  // pollen and seeds drifting in the light, faster with the wind
  float po = elMotes(p, t, 20., vec2(.18 * wind, .06), .1, .12);
  float po2 = elMotes(p + 5., t, 38., vec2(.3 * wind, .1), .12, .1);
  col += u_c3 * (po + po2 * .7) * .55 * (.5 + gap);

  col *= wide > .5 ? mix(.55, 1., smoothstep(.12, .58, uv.x)) : mix(.62, 1., smoothstep(.75, .35, uv.y));
  col *= 1. - .4 * pow(length((uv - .5) * vec2(1., 1.15)), 2.4);
  col += elGrain(fc, t) * .028;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/grove"),
};
