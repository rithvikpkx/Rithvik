import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Tide: the water element. Looking down through clear moving water: a caustic net dancing on the sea floor, a current
// running through it, light shafts from above; the pointer stirs the surface (rings that bend the light), its speed
// strengthens the current, a press drops a stone in.
export const META: DesignMeta = {
  id: "tide", name: "Tide", mood: "clear water, moving", dark: true,
  keywords: ["tide","water","wave","waves","ocean","sea","river","current","ripple","flow","elemental","ninja","teal","aqua"],
  swatch: ["#04131D","#E6FAFF","#2FD4E6","#1A6FB0"],
  cardFont: "\"DM Serif Display\", Georgia, serif",
  fonts: "family=DM+Serif+Display:ital@0;1&family=Manrope:wght@400..700&family=DM+Mono:wght@400;500",
  shader: {
    colors: ["#031019","#0A3A52","#46E3F0","#E9FDFF"], scale: 0.5, host: "#td-gl",
    source: EL_GLSL + `
// caustics: the bright web where light focuses through the waves. Two drifting voronoi edge networks, sharpened
// into thin filaments and brightest where they cross (the classic pool-floor pattern)
float caust(vec2 p, float t){
  float a = 1. - smoothstep(0., .06, elVoro(p, t).y);
  float b = 1. - smoothstep(0., .045, elVoro(p * 1.6 + 3.1, t * 1.3 + 2.).y);
  return a * .75 + b * .45 + a * b * 1.4;
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float deep = smoothstep(.82, .97, u_scroll); // Contact: deeper, slower water
  float ch = u_charge;

  // the surface: a slow swell, rings stirred out from the pointer, and a dropped stone's wave; their slope bends the light
  vec2 dm = p - m; float r = length(dm);
  float stir = sin(r * 58. - t * 5.5) * exp(-r * 5.5) * act * (.35 + .9 * ch);
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  vec2 db = p - bc; float rb = length(db);
  float drop = sin((rb - u_burst.z * .55) * 70.) * elRing(p, bc, u_burst.z, .55, .09) * 1.6;
  vec2 bend = (dm / max(r, 1e-3)) * stir * .016 + (db / max(rb, 1e-3)) * drop * .02;
  vec2 swell = vec2(fbm(p * 1.3 + vec2(t * .05, -t * .04)), fbm(p * 1.3 + vec2(4.2, 1.7) - vec2(t * .04, t * .05)));

  // the current: the whole floor slides one way, faster as the pointer charges it
  vec2 flow = vec2(t * (.035 + .05 * ch), -t * .012);
  vec2 q = p + bend + swell * .06 + flow;

  // the floor: deep blue, rippled sand bands catching the light, darker where the water is deep
  float sand = .5 + .5 * sin((q.x * 1.6 + q.y * 7. + fbm(q * 2.) * 1.6) * 3.);
  float depth = mix(.72 + .28 * fbm(q * .8), .4, deep);
  vec3 col = mix(u_c0, u_c1, depth * (.55 + .2 * sand) * (1. - .4 * deep));

  // caustics, warped by the swell so the cells breathe, and bent further where the surface is stirred
  vec2 cp = q * mix(5.2, 4.2, deep) + swell * .9 + bend * 3.;
  float ct = t * (.55 + .5 * ch) * mix(1., .6, deep);
  float cg = caust(cp, ct);
  float lit = mix(.8, .45, deep) * (.6 + .4 * smoothstep(-.4, .5, swell.x));
  col += mix(u_c2, u_c3, smoothstep(1., 2.2, cg)) * cg * lit * .45;

  // light shafts slanting down from the surface, swaying with the swell
  float shaft = pow(.5 + .5 * sin(p.x * 7. - p.y * 2.6 + swell.y * 3. + t * .12), 9.) * smoothstep(.1, 1., uv.y);
  col += u_c2 * shaft * mix(.1, .05, deep);

  // the stirred surface's own glints, and the drop's ring of foam
  col += u_c3 * (smoothstep(.55, 1., stir) * .35 + smoothstep(.4, 1., drop) * .5);
  // bubbles rising from the floor
  float bub = elMotes(p - vec2(0., -t * .02), t, 18., vec2(.04, -.55 - .4 * ch), .1, .08);
  col += u_c3 * bub * .35 * smoothstep(.9, .1, uv.y);

  // keep the copy column calm: the water deepens toward the left on wide screens
  col *= wide > .5 ? mix(.55, 1., smoothstep(.12, .6, uv.x)) : mix(.6, 1., smoothstep(.75, .35, uv.y));
  col *= 1. - .4 * pow(length((uv - .5) * vec2(1.05, 1.2)), 2.4);
  col += elGrain(fc, t) * .022;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/tide"),
};
