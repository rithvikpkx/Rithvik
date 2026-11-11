import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Stone: the earth element. A cliff face of layered strata, cracked and dusty, lit only by the visitor's lantern: the
// pointer rakes light across the relief, its speed sets the ground trembling, a press is a stamp that cracks the rock
// in a ring and throws up dust.
export const META: DesignMeta = {
  id: "stone", name: "Stone", mood: "strata, lit by hand", dark: true,
  keywords: ["stone","earth","rock","rocks","strata","granite","cliff","quarry","mountain","ground","dust","elemental","ninja","brown","ochre"],
  swatch: ["#17120E","#EFE5D5","#D9A55B","#7C8A5E"],
  cardFont: "\"Cinzel\", \"Trajan Pro\", Georgia, serif",
  fonts: "family=Cinzel:wght@600..900&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Spline+Sans+Mono:wght@400;500",
  shader: {
    colors: ["#120E0B","#5A4632","#B9875A","#F1D8A6"], scale: 0.45, host: "#sn-gl",
    source: EL_GLSL + `
// the rock's height: strata bands folded by slow noise, chipped by fine noise, cut by a crack network
// fold = the slow bend of the layers, computed once per pixel by the caller (it barely changes across a pixel)
float rock(vec2 p, float fold, out float band, out float crack){
  float y = p.y * 5.2 + fold * 2.4 + .35 * sin(p.x * 1.3);
  band = fract(y);
  float layer = floor(y);
  float h = smoothstep(0., .1, band) * smoothstep(1., .82, band) * (.6 + .4 * hash21(vec2(layer, 1.3)));
  h += .22 * (vnoise(p * 14. + layer * 3.7) * .65 + vnoise(p * 31. + layer) * .35);
  vec3 v = elVoro(p * vec2(3.4, 2.6) + layer * .3, 0.);
  crack = 1. - smoothstep(.0, .045, v.y);
  return h - .55 * crack;
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float ch = u_charge;
  float low = smoothstep(.82, .97, u_scroll); // Contact: the bedrock floor, darker and heavier

  // a tremor: the stored charge shakes the face; a stamp's shock rolls through it
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  float shock = elRing(p, bc, u_burst.z, .7, .07);
  vec2 shake = vec2(sin(t * 61.), cos(t * 53.)) * .0035 * ch + normalize(p - bc + 1e-4) * shock * .012;
  vec2 q = p + shake + vec2(0., low * .7);

  float band, crack, b2, c2, b3, c3;
  float fold = fbm(q * vec2(.45, .9) + 3.1) * .9;
  float h = rock(q, fold, band, crack);
  float e = 2.5 / u_res.y;
  float hx = rock(q + vec2(e, 0.), fold, b2, c2), hy = rock(q + vec2(0., e), fold, b3, c3);
  vec3 n = normalize(vec3((h - hx) / e * .012, (h - hy) / e * .012, 1.));

  // two lights: a dim cold sky from above, and the visitor's lantern raking across from the pointer
  vec3 L1 = normalize(vec3(-.3, .8, .55));
  vec2 dm = m - q; float r = length(dm);
  vec3 L2 = normalize(vec3(dm, .28));
  float lantern = act * exp(-r * r * 2.6) * (1.1 + .5 * ch);
  float dif = max(dot(n, L1), 0.) * .38 + max(dot(n, L2), 0.) * lantern * 1.4;

  // the strata's colours: basalt, clay, ochre sandstone, pale limestone, chosen per layer
  float layer = floor(q.y * 5.2 + fold * 2.4 + .35 * sin(q.x * 1.3));
  float pick = hash21(vec2(layer, 7.7));
  vec3 base = pick < .3 ? u_c1 * .7 : pick < .55 ? u_c1 : pick < .8 ? u_c2 * .85 : mix(u_c2, u_c3, .45);
  base *= .75 + .25 * fbm(q * 9. + layer);
  vec3 col = base * (.16 + dif) + u_c3 * pow(max(dot(reflect(-L2, n), vec3(0., 0., 1.)), 0.), 14.) * lantern * .25;
  col *= 1. - .75 * crack; // the cracks are deep and dark
  col = mix(col, u_c0, .25 + .3 * low);

  // a stamp: the rock flashes along its cracks where the shock passes
  col += u_c3 * crack * shock * 1.4;

  // dust: motes hanging in the lantern's beam, more when the ground is shaking
  float d1 = elMotes(p, t, 22., vec2(.03, .05), .12, .16 + .2 * ch);
  float d2 = elMotes(p + 3., t, 46., vec2(-.02, .1), .15, .12 + .15 * ch);
  col += u_c3 * (d1 + d2 * .6) * (.08 + lantern * .6 + shock * 2.);

  col *= wide > .5 ? mix(.55, 1., smoothstep(.14, .6, uv.x)) : mix(.6, 1., smoothstep(.75, .35, uv.y));
  col *= 1. - .5 * pow(length((uv - .5) * vec2(1.05, 1.15)), 2.2);
  col += elGrain(fc, t) * .035;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/stone"),
};
