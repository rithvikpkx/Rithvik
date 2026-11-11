import type { DesignMeta } from "../../lib/designs/types.ts";
import { EL_GLSL } from "../elemental/glsl.ts";

// Volt: the lightning element. A storm at night: clouds lit from inside, a bolt every few seconds, and a charged
// node by the portrait that throws branching arcs at the pointer; the pointer's speed charges the air (more arcs,
// brighter plasma), a press calls a bolt down onto that spot.
export const META: DesignMeta = {
  id: "volt", name: "Volt", mood: "a storm that answers", dark: true,
  keywords: ["volt","lightning","storm","thunder","electric","electricity","plasma","spark","sparks","tesla","energy","elemental","ninja","cyan","neon"],
  swatch: ["#070818","#EAF0FF","#7DF9FF","#A98BFF"],
  cardFont: "\"Saira\", \"Arial Narrow\", sans-serif",
  fonts: "family=Saira:ital,wdth,wght@0,62.5..125,300..900;1,62.5..125,300..900&family=Share+Tech+Mono",
  shader: {
    colors: ["#05061A","#1B1F4A","#7DF9FF","#A98BFF"], scale: 0.5, host: "#vt-gl",
    source: EL_GLSL + `
// glow of a bolt at distance d: a white-hot core and a wide electric halo
vec3 boltGlow(float d, float w, float a){
  return (vec3(1.) * smoothstep(w, 0., d) + u_c2 * exp(-d * 34.) * .55 + u_c3 * exp(-d * 9.) * .18) * a;
}
void main(){
  vec2 fc = gl_FragCoord.xy, uv = fc / u_res;
  float asp = u_res.x / u_res.y, t = u_time, wide = step(1.1, asp);
  vec2 p = vec2(uv.x * asp, uv.y);
  vec2 m = vec2(u_mouse.x * asp, u_mouse.y);
  float act = step(.0015, length(u_mouse - .5));
  float ch = u_charge;
  float px = 1.5 / u_res.y;

  // storm clouds rolling over, lit from within whenever lightning fires
  vec2 cq = p * vec2(1.1, 1.6) + vec2(t * .02, 0.);
  float cl = fbm(cq + fbm(cq * 1.7 + t * .03) * .7);
  // a strike every ~3.7s: a sharp flash with a flicker of after-strokes
  float cyc = t / 3.7, ci = floor(cyc), ph = fract(cyc) * 3.7;
  float flash = (exp(-ph * 9.) + .6 * exp(-abs(ph - .16) * 40.) + .4 * exp(-abs(ph - .3) * 50.)) * step(.25, hash21(vec2(ci, 2.)));
  vec3 col = mix(u_c0, u_c1, smoothstep(-.3, .9, cl) * (.55 + .45 * uv.y));
  col += u_c3 * smoothstep(.1, .9, cl) * flash * .35 * smoothstep(.2, 1., uv.y);

  // the sky bolt: falls from the cloud base at a new place each strike, forking once
  float bx = (.15 + .7 * hash21(vec2(ci, 9.))) * asp;
  vec2 top = vec2(bx, 1.05), bot = vec2(bx + (hash21(vec2(ci, 4.)) - .5) * .5, -.05);
  float d = elBolt(p, top, bot, ci, 3.1, .5);
  vec2 fk = mix(top, bot, .45 + .1 * hash21(vec2(ci, 6.)));
  d = min(d, elBolt(p, fk, fk + vec2((hash21(vec2(ci, 7.)) - .5) * .7, -.42), ci, 8.3, .6) + .002);
  col += boltGlow(d, px * 1.3, min(1., flash * 1.4));

  // the charged node by the portrait, and the arcs it throws at the pointer: they snap to new shapes 14 times a second
  vec2 node = wide > .5 ? vec2(asp * .785, .58) : vec2(asp * .5, .3); // behind the photo: the portrait is the charged node
  float reach = length(m - node);
  float arcOn = act * smoothstep(1.15, .25, reach) * (.55 + .45 * ch);
  float fl = floor(t * 14.);
  float a1 = elBolt(p, node, m, fl, 1.7, .35);
  float a2 = elBolt(p, node, m + vec2(.05, -.04), fl + 3., 5.3, .45) + .0015;
  float a3 = ch > .25 ? elBolt(p, node, m + vec2(-.06, .05), fl + 7., 9.1, .55) + .002 : 1.;
  float ad = min(a1, min(a2, a3));
  float jit = step(.18, hash21(vec2(fl, 1.)));  // now and then the arc drops out for a frame, like a real one
  col += boltGlow(ad, px * 1.1, arcOn * jit);
  // the node: a plasma ball that brightens with the charge
  float nd = length(p - node);
  col += u_c2 * exp(-nd * mix(26., 14., ch)) * (.35 + .5 * ch) + vec3(1.) * smoothstep(.012, 0., nd) * (.5 + .5 * ch);
  // the pointer end: a hot spot where the arc lands
  col += u_c2 * exp(-length(p - m) * 40.) * arcOn * .6 * jit;

  // a called strike: a bolt from the sky onto the pressed spot, a shock ring and a flash
  vec2 bc = vec2(u_burst.x * asp, u_burst.y);
  float sa = u_burst.z;
  float sb = elBolt(p, vec2(bc.x + .1, 1.08), bc, floor(sa * 18.), 4.4, .45);
  col += boltGlow(sb, px * 1.6, exp(-sa * 4.) * step(sa, 3.));
  col += u_c2 * elRing(p, bc, sa, 1.1, .03) * .9 + vec3(.6, .8, 1.) * exp(-sa * 10.) * .25 * step(sa, 3.);

  // rain streaks, faint and fast
  vec2 rq = vec2(p.x * 90. + p.y * 9., p.y * 7. + t * 9.);
  col += u_c2 * step(.985, hash21(floor(rq))) * fract(rq.y) * .07;

  col *= wide > .5 ? mix(.6, 1., smoothstep(.1, .55, uv.x)) : 1.;
  col *= 1. - .45 * pow(length((uv - .5) * vec2(1., 1.15)), 2.4);
  col += elGrain(fc, t) * .03;
  gl_FragColor = vec4(max(col, 0.), 1.);
}`,
  },
  load: () => import("@/designs/volt"),
};
